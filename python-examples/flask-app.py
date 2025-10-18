from flask import Flask, request, jsonify, render_template_string
from flask_cors import CORS
import requests
from bs4 import BeautifulSoup
import re
from urllib.parse import urljoin, urlparse
import logging

app = Flask(__name__)
CORS(app)

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# HTML template for the frontend
HTML_TEMPLATE = """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Font Scanner - Flask</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        .input-group { margin: 20px 0; }
        button { background: #007bff; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; }
        button:hover { background: #0056b3; }
        .results { margin-top: 20px; padding: 20px; background: #f8f9fa; border-radius: 4px; }
        .font-item { margin: 10px 0; padding: 10px; border: 1px solid #ddd; border-radius: 4px; }
        .loading { color: #666; font-style: italic; }
    </style>
</head>
<body>
    <h1>🔍 Font Scanner - Flask Edition</h1>
    
    <div class="input-group">
        <input type="url" id="urlInput" placeholder="Enter website URL..." style="width: 300px; padding: 10px;">
        <button onclick="scanFonts()">Scan Fonts</button>
    </div>
    
    <div id="results"></div>

    <script>
        async function scanFonts() {
            const url = document.getElementById('urlInput').value;
            const resultsDiv = document.getElementById('results');
            
            if (!url) {
                alert('Please enter a URL');
                return;
            }
            
            resultsDiv.innerHTML = '<div class="loading">Scanning fonts...</div>';
            
            try {
                const response = await fetch('/api/scan', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url: url })
                });
                
                const data = await response.json();
                displayResults(data);
            } catch (error) {
                resultsDiv.innerHTML = `<div style="color: red;">Error: ${error.message}</div>`;
            }
        }
        
        function displayResults(data) {
            const resultsDiv = document.getElementById('results');
            
            if (data.error) {
                resultsDiv.innerHTML = `<div style="color: red;">Error: ${data.error}</div>`;
                return;
            }
            
            let html = '<div class="results"><h2>Font Analysis Results</h2>';
            
            if (data.fonts && data.fonts.length > 0) {
                html += '<h3>Detected Fonts:</h3>';
                data.fonts.forEach(font => {
                    html += `
                        <div class="font-item">
                            <strong>${font.family}</strong>
                            <br>Type: ${font.type}
                            ${font.source ? `<br>Source: ${font.source}` : ''}
                        </div>
                    `;
                });
            } else {
                html += '<p>No fonts detected.</p>';
            }
            
            html += '</div>';
            resultsDiv.innerHTML = html;
        }
    </script>
</body>
</html>
"""

class FontAnalyzer:
    def __init__(self):
        self.google_fonts = [
            'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Source Sans Pro',
            'Raleway', 'Poppins', 'Oswald', 'Nunito', 'Ubuntu', 'Mulish',
            'Inter', 'Playfair Display', 'Merriweather', 'PT Sans'
        ]
        
    def is_google_font(self, font_name):
        return any(gf.lower() in font_name.lower() for gf in self.google_fonts)
    
    def extract_fonts_from_css(self, css_content, base_url):
        fonts = []
        
        # Find @import statements for Google Fonts
        import_pattern = r'@import\s+url\([\'"]?([^\'")]*fonts\.googleapis\.com[^\'")]*)[\'"]?\)'
        imports = re.findall(import_pattern, css_content)
        
        for import_url in imports:
            # Extract family parameter from Google Fonts URL
            family_match = re.search(r'family=([^&]*)', import_url)
            if family_match:
                families = family_match.group(1).replace('+', ' ').split('|')
                for family in families:
                    clean_family = family.split(':')[0]
                    fonts.append({
                        'family': clean_family,
                        'type': 'google',
                        'source': import_url
                    })
        
        # Find font-family declarations
        font_family_pattern = r'font-family\s*:\s*([^;}]+)'
        declarations = re.findall(font_family_pattern, css_content, re.IGNORECASE)
        
        for declaration in declarations:
            # Clean up the font family names
            families = [f.strip().strip('\'"') for f in declaration.split(',')]
            for family in families:
                if family and family not in ['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy']:
                    font_type = 'google' if self.is_google_font(family) else 'web'
                    fonts.append({
                        'family': family,
                        'type': font_type,
                        'source': 'css'
                    })
        
        return fonts
    
    def analyze_website(self, url):
        try:
            logger.info(f"Analyzing fonts for: {url}")
            
            # Fetch the webpage
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
            response = requests.get(url, headers=headers, timeout=10)
            response.raise_for_status()
            
            soup = BeautifulSoup(response.content, 'html.parser')
            fonts = []
            
            # Check for Google Fonts link tags
            google_font_links = soup.find_all('link', href=lambda x: x and 'fonts.googleapis.com' in x)
            for link in google_font_links:
                href = link.get('href')
                # Extract family parameter
                family_match = re.search(r'family=([^&]*)', href)
                if family_match:
                    families = family_match.group(1).replace('+', ' ').split('|')
                    for family in families:
                        clean_family = family.split(':')[0]
                        fonts.append({
                            'family': clean_family,
                            'type': 'google',
                            'source': href
                        })
            
            # Analyze inline styles
            style_tags = soup.find_all('style')
            for style in style_tags:
                if style.string:
                    css_fonts = self.extract_fonts_from_css(style.string, url)
                    fonts.extend(css_fonts)
            
            # Analyze external stylesheets
            css_links = soup.find_all('link', rel='stylesheet')
            for link in css_links:
                href = link.get('href')
                if href:
                    try:
                        css_url = urljoin(url, href)
                        css_response = requests.get(css_url, headers=headers, timeout=5)
                        css_fonts = self.extract_fonts_from_css(css_response.text, css_url)
                        fonts.extend(css_fonts)
                    except Exception as e:
                        logger.warning(f"Failed to fetch CSS from {href}: {e}")
            
            # Remove duplicates
            unique_fonts = []
            seen = set()
            for font in fonts:
                font_key = f"{font['family']}-{font['type']}"
                if font_key not in seen:
                    seen.add(font_key)
                    unique_fonts.append(font)
            
            logger.info(f"Found {len(unique_fonts)} unique fonts")
            return {
                'success': True,
                'fonts': unique_fonts,
                'total_fonts': len(unique_fonts),
                'url': url
            }
            
        except Exception as e:
            logger.error(f"Error analyzing {url}: {e}")
            return {
                'success': False,
                'error': str(e),
                'fonts': [],
                'url': url
            }

# Initialize the analyzer
font_analyzer = FontAnalyzer()

@app.route('/')
def index():
    return render_template_string(HTML_TEMPLATE)

@app.route('/api/scan', methods=['POST'])
def scan_fonts():
    try:
        data = request.get_json()
        url = data.get('url')
        
        if not url:
            return jsonify({'error': 'URL is required'}), 400
        
        # Validate URL
        parsed = urlparse(url)
        if not parsed.scheme or not parsed.netloc:
            return jsonify({'error': 'Invalid URL'}), 400
        
        # Analyze the website
        result = font_analyzer.analyze_website(url)
        
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"API error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/health')
def health():
    return jsonify({'status': 'healthy', 'service': 'font-scanner-flask'})

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)