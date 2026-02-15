/**
 * VisualSitemap – D3-powered interactive sitemap component
 * Provides tree & force-graph modes, pan/zoom, search, tooltip, inspector, legend.
 * IIFE pattern, exposed on window.VisualSitemap.
 */
(function () {
  'use strict';

  /* ====================================================================
     Translation helper (uses global i18n when available)
     ==================================================================== */
  function t(key, fallback, params) {
    var value = fallback;
    if (window.i18n && typeof window.i18n.t === 'function') {
      var translated = window.i18n.t(key);
      if (translated !== key) value = translated;
    }
    if (params && typeof value === 'string') {
      Object.keys(params).forEach(function (p) {
        value = value.replace(new RegExp('\\{\\{?' + p + '\\}?\\}', 'g'), params[p]);
      });
    }
    return value;
  }

  /* ====================================================================
     Page-type heuristic (mirrors site-crawler-script getPageType)
     ==================================================================== */
  var PAGE_TYPE_RULES = [
    { test: /\/(blog|article|news|post)/i, icon: '\u{1F4DD}', label: 'Blog', color: '#8b5cf6', key: 'blog' },
    { test: /\/(product|shop|store|item)/i, icon: '\u{1F6D2}', label: 'Product', color: '#10b981', key: 'product' },
    { test: /\/(about|team|company)/i, icon: '\u{1F465}', label: 'About', color: '#6366f1', key: 'about' },
    { test: /\/(contact|support|help)/i, icon: '\u{1F4DE}', label: 'Contact', color: '#ec4899', key: 'contact' },
    { test: /\/(event|calendar|schedule)/i, icon: '\u{1F4C5}', label: 'Event', color: '#f59e0b', key: 'event' },
    { test: /\/(gallery|photo|image|media)/i, icon: '\u{1F5BC}', label: 'Media', color: '#14b8a6', key: 'media' },
    { test: /\/(faq|question)/i, icon: '\u{2753}', label: 'FAQ', color: '#f97316', key: 'faq' },
    { test: /\/(login|signin|account|register)/i, icon: '\u{1F510}', label: 'Auth', color: '#ef4444', key: 'auth' },
    { test: /\/(search|find)/i, icon: '\u{1F50D}', label: 'Search', color: '#3b82f6', key: 'search' },
    { test: /\.(pdf|doc|docx|xls|xlsx)$/i, icon: '\u{1F4C4}', label: 'Document', color: '#dc2626', key: 'document' }
  ];

  function getPageType(url) {
    var path = url.toLowerCase();
    for (var i = 0; i < PAGE_TYPE_RULES.length; i++) {
      if (PAGE_TYPE_RULES[i].test.test(path)) {
        var r = PAGE_TYPE_RULES[i];
        return { icon: r.icon, label: r.label, color: r.color, key: r.key };
      }
    }
    if (/\/$/.test(path) || path.split('/').filter(function (p) { return p; }).length <= 1) {
      return { icon: '\u{1F3E0}', label: 'Main', color: '#22c55e', key: 'main' };
    }
    return { icon: '\u{1F4C3}', label: 'Page', color: '#64748b', key: 'page' };
  }

  /* ====================================================================
     Data normalisation – builds d3.hierarchy-compatible tree + flat list
     ==================================================================== */
  function normalizePages(pages, siteStructure, hostname) {
    var flatNodes = [];
    var pageTypes = new Map();

    // Build tree from URL paths
    var root = { name: hostname || '/', path: '/', depth: 0, children: [], url: null, pageType: null };

    pages.forEach(function (url) {
      try {
        var urlObj = new URL(url);
        var parts = urlObj.pathname.split('/').filter(function (p) { return p; });
        var current = root;
        var currentPath = '';

        parts.forEach(function (part, idx) {
          currentPath += '/' + part;
          var existing = current.children.find(function (c) { return c.name === part; });
          if (!existing) {
            existing = {
              name: part,
              path: currentPath,
              depth: idx + 1,
              children: [],
              url: idx === parts.length - 1 ? url : null,
              pageType: null
            };
            current.children.push(existing);
          }
          if (idx === parts.length - 1) {
            existing.url = url;
          }
          current = existing;
        });

        // Root URL (homepage)
        if (parts.length === 0) {
          root.url = url;
        }
      } catch (e) { /* skip invalid */ }
    });

    // Assign page types & build flat list + type counts
    function walk(node) {
      if (node.url) {
        node.pageType = getPageType(node.url);
      } else if (node.children.length > 0) {
        node.pageType = { icon: '\u{1F4C1}', label: 'Section', color: '#a78bfa', key: 'section' };
      } else {
        node.pageType = { icon: '\u{1F4C3}', label: 'Page', color: '#64748b', key: 'page' };
      }

      var key = node.pageType.key;
      var entry = pageTypes.get(key);
      if (!entry) {
        entry = { count: 0, color: node.pageType.color, label: node.pageType.label, icon: node.pageType.icon };
        pageTypes.set(key, entry);
      }
      entry.count++;

      flatNodes.push(node);
      node.children.forEach(walk);
    }
    walk(root);

    // Build links for graph mode
    var links = [];
    function buildLinks(node) {
      node.children.forEach(function (child) {
        links.push({ source: node, target: child });
        buildLinks(child);
      });
    }
    buildLinks(root);

    return {
      root: root,
      flatNodes: flatNodes,
      links: links,
      nodeCount: flatNodes.length,
      pageTypes: pageTypes
    };
  }

  /* ====================================================================
     Count descendants helper
     ==================================================================== */
  function countDescendants(node) {
    if (!node.children || node.children.length === 0) return 0;
    var count = node.children.length;
    node.children.forEach(function (c) { count += countDescendants(c); });
    return count;
  }

  /* ====================================================================
     Instances store (for cleanup)
     ==================================================================== */
  var instances = {};

  /* ====================================================================
     renderPlaceholder – returns HTML string for the accordion body
     ==================================================================== */
  function renderPlaceholder(containerId, options) {
    var id = containerId || 'main';
    return (
      '<div class="visual-sitemap" id="vs-' + id + '">' +
        '<div class="visual-sitemap__toolbar">' +
          '<div class="visual-sitemap__mode-toggle">' +
            '<button class="visual-sitemap__mode-btn visual-sitemap__mode-btn--active" data-vs-mode="tree">' +
              t('reports.crawler.treeMode', 'Tree') +
            '</button>' +
            '<button class="visual-sitemap__mode-btn" data-vs-mode="graph">' +
              t('reports.crawler.graphMode', 'Graph') +
            '</button>' +
          '</div>' +
          '<input class="visual-sitemap__search" type="text" placeholder="' +
            t('reports.crawler.searchPlaceholder', 'Search pages...') +
          '" data-vs-search />' +
          '<div class="visual-sitemap__toolbar-actions">' +
            '<button class="visual-sitemap__action-btn" data-vs-action="fit">' +
              t('reports.crawler.fitToView', 'Fit') +
            '</button>' +
            '<button class="visual-sitemap__action-btn" data-vs-action="reset">' +
              t('reports.crawler.resetView', 'Reset') +
            '</button>' +
            '<button class="visual-sitemap__action-btn" data-vs-action="collapse-all">' +
              t('reports.crawler.collapseAll', 'Collapse') +
            '</button>' +
            '<button class="visual-sitemap__action-btn" data-vs-action="expand-all">' +
              t('reports.crawler.expandAll', 'Expand') +
            '</button>' +
          '</div>' +
        '</div>' +
        '<div class="visual-sitemap__stats" data-vs-stats></div>' +
        '<div class="visual-sitemap__canvas" data-vs-canvas>' +
          '<div class="visual-sitemap__rendering-msg" data-vs-rendering style="display:none;">' +
            t('reports.crawler.rendering', 'Rendering...') +
          '</div>' +
        '</div>' +
        '<div class="visual-sitemap__legend" data-vs-legend></div>' +
        '<div class="visual-sitemap__tooltip" data-vs-tooltip></div>' +
        '<div class="visual-sitemap__inspector" data-vs-inspector>' +
          '<div class="visual-sitemap__inspector-header">' +
            '<span class="visual-sitemap__inspector-title">' +
              t('reports.crawler.inspectorTitle', 'Page Details') +
            '</span>' +
            '<button class="visual-sitemap__inspector-close" data-vs-inspector-close>&times;</button>' +
          '</div>' +
          '<div class="visual-sitemap__inspector-body" data-vs-inspector-body></div>' +
        '</div>' +
      '</div>'
    );
  }

  /* ====================================================================
     init – attaches D3 to rendered DOM
     ==================================================================== */
  function init(containerId, data) {
    if (typeof d3 === 'undefined') {
      console.warn('[VisualSitemap] D3 not loaded');
      return;
    }

    var id = containerId || 'main';
    var el = document.getElementById('vs-' + id);
    if (!el) {
      console.warn('[VisualSitemap] Container #vs-' + id + ' not found');
      return;
    }

    // Cleanup previous instance
    destroy(id);

    var pages = data.pages || [];
    var siteStructure = data.siteStructure || {};
    var hostname = data.hostname || '';

    if (pages.length === 0) {
      var canvas = el.querySelector('[data-vs-canvas]');
      if (canvas) canvas.innerHTML = '<div style="text-align:center;padding:3rem;color:var(--color-text-muted);">' +
        t('reports.crawler.noDirectoryStructure', 'No directory structure detected (flat site)') + '</div>';
      return;
    }

    var normalized = normalizePages(pages, siteStructure, hostname);
    var mode = 'tree'; // 'tree' | 'graph'
    var LARGE_THRESHOLD = 300;

    // Instance state
    var state = {
      el: el,
      normalized: normalized,
      mode: mode,
      svg: null,
      g: null,
      zoom: null,
      simulation: null,
      collapsedSet: new Set(),
      searchTerm: '',
      inspectorOpen: false,
      themeObserver: null
    };
    instances[id] = state;

    // Render stats bar
    renderStats(state);

    // Render legend
    renderLegend(state);

    // Initial render
    renderTree(state);

    // --- Wire up toolbar ---
    var modeBtns = el.querySelectorAll('[data-vs-mode]');
    modeBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var newMode = btn.getAttribute('data-vs-mode');
        if (newMode === state.mode) return;
        state.mode = newMode;
        modeBtns.forEach(function (b) { b.classList.remove('visual-sitemap__mode-btn--active'); });
        btn.classList.add('visual-sitemap__mode-btn--active');

        // Show/hide collapse/expand buttons
        var collapseBtn = el.querySelector('[data-vs-action="collapse-all"]');
        var expandBtn = el.querySelector('[data-vs-action="expand-all"]');
        if (collapseBtn) collapseBtn.style.display = newMode === 'tree' ? '' : 'none';
        if (expandBtn) expandBtn.style.display = newMode === 'tree' ? '' : 'none';

        if (newMode === 'tree') {
          stopSimulation(state);
          renderTree(state);
        } else {
          renderGraph(state);
        }
      });
    });

    // Search
    var searchInput = el.querySelector('[data-vs-search]');
    if (searchInput) {
      var debounceTimer = null;
      searchInput.addEventListener('input', function () {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(function () {
          state.searchTerm = searchInput.value.trim().toLowerCase();
          applySearch(state);
        }, 200);
      });
    }

    // Action buttons
    el.addEventListener('click', function (e) {
      var action = e.target.getAttribute('data-vs-action');
      if (!action) {
        var parent = e.target.closest('[data-vs-action]');
        if (parent) action = parent.getAttribute('data-vs-action');
      }
      if (!action) return;

      if (action === 'fit') fitToView(state);
      else if (action === 'reset') resetView(state);
      else if (action === 'collapse-all') collapseAll(state);
      else if (action === 'expand-all') expandAll(state);
    });

    // Inspector close
    var inspCloseBtn = el.querySelector('[data-vs-inspector-close]');
    if (inspCloseBtn) {
      inspCloseBtn.addEventListener('click', function () {
        closeInspector(state);
      });
    }

    // Theme observer
    state.themeObserver = new MutationObserver(function () {
      if (state.mode === 'tree') renderTree(state);
      else renderGraph(state);
    });
    state.themeObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });

    // Auto-collapse for large sites
    if (normalized.nodeCount >= LARGE_THRESHOLD && state.mode === 'tree') {
      normalized.root.children.forEach(function (child) {
        collapseRecursive(child, state.collapsedSet);
      });
      renderTree(state);
    }
  }

  /* ====================================================================
     Stats bar
     ==================================================================== */
  function renderStats(state) {
    var statsEl = state.el.querySelector('[data-vs-stats]');
    if (!statsEl) return;
    var n = state.normalized;
    var crawled = n.flatNodes.filter(function (nd) { return nd.url; }).length;
    var total = n.nodeCount;
    var html =
      '<span class="visual-sitemap__stats-item">' +
        t('reports.crawler.pagesCrawled', 'Pages crawled') + ': ' +
        '<span class="visual-sitemap__stats-value">' + crawled + '</span>' +
      '</span>' +
      '<span class="visual-sitemap__stats-item">' +
        t('reports.crawler.pagesVisualized', 'Nodes visualized') + ': ' +
        '<span class="visual-sitemap__stats-value">' + total + '</span>' +
      '</span>';
    statsEl.innerHTML = html;
  }

  /* ====================================================================
     Legend
     ==================================================================== */
  function renderLegend(state) {
    var legendEl = state.el.querySelector('[data-vs-legend]');
    if (!legendEl) return;
    var html = '<span class="visual-sitemap__legend-title">' +
      t('reports.crawler.legendTitle', 'Legend') + '</span>';
    state.normalized.pageTypes.forEach(function (val, key) {
      html +=
        '<span class="visual-sitemap__legend-item">' +
          '<span class="visual-sitemap__legend-dot" style="background:' + val.color + '"></span>' +
          val.label +
          '<span class="visual-sitemap__legend-count">(' + val.count + ')</span>' +
        '</span>';
    });
    legendEl.innerHTML = html;
  }

  /* ====================================================================
     TREE MODE
     ==================================================================== */
  function renderTree(state) {
    var canvasEl = state.el.querySelector('[data-vs-canvas]');
    if (!canvasEl) return;
    canvasEl.innerHTML = '';

    var width = canvasEl.clientWidth || 800;
    var height = canvasEl.clientHeight || 500;

    // Build hierarchy with collapse support
    var rootCopy = cloneWithCollapse(state.normalized.root, state.collapsedSet);
    var hierarchy = d3.hierarchy(rootCopy, function (d) { return d.children; });

    // Tree layout
    var nodeCount = hierarchy.descendants().length;
    var treeHeight = Math.max(height - 60, nodeCount * 24);
    var treeWidth = Math.max(width - 200, 400);

    var treeLayout = d3.tree().size([treeHeight, treeWidth]);
    treeLayout(hierarchy);

    // Create SVG
    var svg = d3.select(canvasEl).append('svg')
      .attr('width', width)
      .attr('height', height);

    var g = svg.append('g').attr('transform', 'translate(80, 30)');

    // Zoom
    var zoom = d3.zoom()
      .scaleExtent([0.1, 4])
      .on('zoom', function (event) {
        g.attr('transform', event.transform);
      });
    svg.call(zoom);

    state.svg = svg;
    state.g = g;
    state.zoom = zoom;

    // Links
    g.selectAll('.vs-link')
      .data(hierarchy.links())
      .enter()
      .append('path')
      .attr('class', 'vs-link')
      .attr('d', function (d) {
        return 'M' + d.source.y + ',' + d.source.x +
          'C' + (d.source.y + d.target.y) / 2 + ',' + d.source.x +
          ' ' + (d.source.y + d.target.y) / 2 + ',' + d.target.x +
          ' ' + d.target.y + ',' + d.target.x;
      });

    // Nodes
    var nodes = g.selectAll('.vs-node')
      .data(hierarchy.descendants())
      .enter()
      .append('g')
      .attr('class', function (d) {
        var cls = 'vs-node';
        if (d.data._collapsed) cls += ' vs-node--collapsed';
        if (d.data._originalChildren && d.data._originalChildren.length > 0) cls += ' vs-node--has-children';
        return cls;
      })
      .attr('transform', function (d) { return 'translate(' + d.y + ',' + d.x + ')'; });

    nodes.append('circle')
      .attr('r', function (d) { return d.depth === 0 ? 8 : 5; })
      .attr('fill', function (d) { return d.data.pageType ? d.data.pageType.color : '#64748b'; })
      .attr('stroke', function (d) {
        return d.data._collapsed ? 'var(--color-warning)' : 'var(--border-color-strong)';
      })
      .attr('stroke-width', function (d) { return d.data._collapsed ? 2.5 : 1.5; });

    // Badge for collapsed nodes showing hidden children count
    nodes.filter(function (d) { return d.data._collapsed && d.data._originalChildren; })
      .append('text')
      .attr('dy', -10)
      .attr('text-anchor', 'middle')
      .attr('font-size', '9px')
      .attr('fill', 'var(--color-warning)')
      .text(function (d) { return '+' + countAllDescendants(d.data); });

    nodes.append('text')
      .attr('dy', 3)
      .attr('x', function (d) { return d.children ? -12 : 12; })
      .attr('text-anchor', function (d) { return d.children ? 'end' : 'start'; })
      .attr('font-size', '11px')
      .text(function (d) {
        var name = d.data.name;
        return name.length > 28 ? name.slice(0, 26) + '\u2026' : name;
      });

    // Interactions
    nodes.on('mouseover', function (event, d) { showTooltip(state, event, d.data); })
      .on('mouseout', function () { hideTooltip(state); })
      .on('click', function (event, d) {
        event.stopPropagation();
        // Toggle collapse
        if (d.data._originalChildren && d.data._originalChildren.length > 0) {
          if (state.collapsedSet.has(d.data.path)) {
            state.collapsedSet.delete(d.data.path);
          } else {
            state.collapsedSet.add(d.data.path);
          }
          renderTree(state);
        }
        openInspector(state, d.data);
        scrollToPageItem(d.data);
      });

    // Fit to view initially
    fitToView(state);
  }

  /* ====================================================================
     GRAPH MODE
     ==================================================================== */
  function renderGraph(state) {
    var canvasEl = state.el.querySelector('[data-vs-canvas]');
    if (!canvasEl) return;
    canvasEl.innerHTML = '';

    var width = canvasEl.clientWidth || 800;
    var height = canvasEl.clientHeight || 500;

    var svg = d3.select(canvasEl).append('svg')
      .attr('width', width)
      .attr('height', height);

    var g = svg.append('g');

    // Zoom
    var zoom = d3.zoom()
      .scaleExtent([0.1, 4])
      .on('zoom', function (event) {
        g.attr('transform', event.transform);
      });
    svg.call(zoom);

    state.svg = svg;
    state.g = g;
    state.zoom = zoom;

    var flat = state.normalized.flatNodes;
    var links = state.normalized.links;

    // Create simulation-friendly copies
    var nodeMap = new Map();
    var simNodes = flat.map(function (nd, i) {
      var sn = { id: nd.path, x: width / 2 + (Math.random() - 0.5) * 200, y: height / 2 + (Math.random() - 0.5) * 200, data: nd, index: i };
      nodeMap.set(nd.path, sn);
      return sn;
    });

    var simLinks = [];
    links.forEach(function (lnk) {
      var s = nodeMap.get(lnk.source.path);
      var t = nodeMap.get(lnk.target.path);
      if (s && t) simLinks.push({ source: s, target: t });
    });

    // Force simulation
    var simulation = d3.forceSimulation(simNodes)
      .force('link', d3.forceLink(simLinks).distance(50).strength(0.5))
      .force('charge', d3.forceManyBody().strength(-80))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collide', d3.forceCollide(18));

    state.simulation = simulation;

    // Links
    var link = g.selectAll('.vs-link')
      .data(simLinks)
      .enter()
      .append('line')
      .attr('class', 'vs-link');

    // Nodes
    var node = g.selectAll('.vs-node')
      .data(simNodes)
      .enter()
      .append('g')
      .attr('class', 'vs-node')
      .call(d3.drag()
        .on('start', function (event, d) {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x; d.fy = d.y;
        })
        .on('drag', function (event, d) {
          d.fx = event.x; d.fy = event.y;
        })
        .on('end', function (event, d) {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null; d.fy = null;
        })
      );

    node.append('circle')
      .attr('r', function (d) { return d.data.depth === 0 ? 10 : 6; })
      .attr('fill', function (d) { return d.data.pageType ? d.data.pageType.color : '#64748b'; })
      .attr('stroke', 'var(--border-color-strong)')
      .attr('stroke-width', 1.5);

    node.append('text')
      .attr('dy', -10)
      .attr('text-anchor', 'middle')
      .attr('font-size', '10px')
      .text(function (d) {
        var n = d.data.name;
        return n.length > 20 ? n.slice(0, 18) + '\u2026' : n;
      });

    // Interactions
    node.on('mouseover', function (event, d) { showTooltip(state, event, d.data); })
      .on('mouseout', function () { hideTooltip(state); })
      .on('click', function (event, d) {
        openInspector(state, d.data);
        scrollToPageItem(d.data);
      });

    simulation.on('tick', function () {
      link
        .attr('x1', function (d) { return d.source.x; })
        .attr('y1', function (d) { return d.source.y; })
        .attr('x2', function (d) { return d.target.x; })
        .attr('y2', function (d) { return d.target.y; });

      node.attr('transform', function (d) { return 'translate(' + d.x + ',' + d.y + ')'; });
    });

    // Let it settle then fit
    setTimeout(function () { fitToView(state); }, 800);
  }

  /* ====================================================================
     Zoom / Pan helpers
     ==================================================================== */
  function fitToView(state) {
    if (!state.svg || !state.g || !state.zoom) return;
    var canvasEl = state.el.querySelector('[data-vs-canvas]');
    var width = canvasEl.clientWidth || 800;
    var height = canvasEl.clientHeight || 500;

    var bounds = state.g.node().getBBox();
    if (bounds.width === 0 || bounds.height === 0) return;

    var padding = 40;
    var scaleX = (width - padding * 2) / bounds.width;
    var scaleY = (height - padding * 2) / bounds.height;
    var scale = Math.min(scaleX, scaleY, 1.5);

    var tx = (width - bounds.width * scale) / 2 - bounds.x * scale;
    var ty = (height - bounds.height * scale) / 2 - bounds.y * scale;

    state.svg.transition().duration(500).call(
      state.zoom.transform,
      d3.zoomIdentity.translate(tx, ty).scale(scale)
    );
  }

  function resetView(state) {
    if (!state.svg || !state.zoom) return;
    state.svg.transition().duration(500).call(
      state.zoom.transform,
      d3.zoomIdentity
    );
  }

  /* ====================================================================
     Collapse / Expand helpers
     ==================================================================== */
  function cloneWithCollapse(node, collapsedSet) {
    var copy = {
      name: node.name,
      path: node.path,
      depth: node.depth,
      url: node.url,
      pageType: node.pageType,
      _collapsed: collapsedSet.has(node.path),
      _originalChildren: node.children || [],
      children: []
    };
    if (!copy._collapsed && node.children) {
      copy.children = node.children.map(function (c) { return cloneWithCollapse(c, collapsedSet); });
    }
    return copy;
  }

  function collapseRecursive(node, set) {
    if (node.children && node.children.length > 0) {
      set.add(node.path);
      node.children.forEach(function (c) { collapseRecursive(c, set); });
    }
  }

  function countAllDescendants(node) {
    var orig = node._originalChildren || node.children || [];
    if (orig.length === 0) return 0;
    var count = orig.length;
    orig.forEach(function (c) { count += countAllDescendants(c); });
    return count;
  }

  function collapseAll(state) {
    state.normalized.root.children.forEach(function (child) {
      collapseRecursive(child, state.collapsedSet);
    });
    if (state.mode === 'tree') renderTree(state);
  }

  function expandAll(state) {
    state.collapsedSet.clear();
    if (state.mode === 'tree') renderTree(state);
  }

  /* ====================================================================
     Search
     ==================================================================== */
  function applySearch(state) {
    if (!state.g) return;
    var term = state.searchTerm;

    // Remove any previous no-match message
    var prev = state.el.querySelector('.visual-sitemap__no-match');
    if (prev) prev.remove();

    if (!term) {
      // Clear all dim/highlight
      state.g.selectAll('.vs-node')
        .classed('vs-node--highlighted', false)
        .classed('vs-node--dimmed', false);
      return;
    }

    var matchCount = 0;
    var firstMatch = null;

    state.g.selectAll('.vs-node').each(function (d) {
      var nodeData = d.data || d;
      var path = (nodeData.path || nodeData.name || '').toLowerCase();
      var matches = path.indexOf(term) !== -1;
      d3.select(this)
        .classed('vs-node--highlighted', matches)
        .classed('vs-node--dimmed', !matches);
      if (matches) {
        matchCount++;
        if (!firstMatch) firstMatch = d;
      }
    });

    if (matchCount === 0) {
      var canvas = state.el.querySelector('[data-vs-canvas]');
      if (canvas) {
        var msg = document.createElement('div');
        msg.className = 'visual-sitemap__no-match';
        msg.textContent = t('reports.crawler.noMatchFound', 'No match found');
        canvas.appendChild(msg);
      }
    } else if (firstMatch && state.mode === 'tree') {
      // Auto-zoom to first match
      zoomToNode(state, firstMatch);
    }
  }

  function zoomToNode(state, d) {
    if (!state.svg || !state.zoom) return;
    var canvasEl = state.el.querySelector('[data-vs-canvas]');
    var width = canvasEl.clientWidth || 800;
    var height = canvasEl.clientHeight || 500;

    var x = d.y || 0;
    var y = d.x || 0;
    var scale = 1.5;

    state.svg.transition().duration(500).call(
      state.zoom.transform,
      d3.zoomIdentity.translate(width / 2 - x * scale, height / 2 - y * scale).scale(scale)
    );
  }

  /* ====================================================================
     Tooltip
     ==================================================================== */
  function showTooltip(state, event, nodeData) {
    var tip = state.el.querySelector('[data-vs-tooltip]');
    if (!tip) return;

    var section = nodeData.path ? nodeData.path.split('/').filter(function (p) { return p; })[0] || '/' : '/';
    var childCount = nodeData.children ? nodeData.children.length : 0;
    var desc = countDescendants(nodeData);
    var pt = nodeData.pageType || {};

    tip.innerHTML =
      '<div class="visual-sitemap__tooltip-url">' + escapeHtml(nodeData.url || nodeData.path || nodeData.name) + '</div>' +
      '<div class="visual-sitemap__tooltip-row"><span class="visual-sitemap__tooltip-label">' + t('reports.crawler.nodeType', 'Type') + '</span><span class="visual-sitemap__tooltip-value">' + (pt.icon || '') + ' ' + (pt.label || 'Page') + '</span></div>' +
      '<div class="visual-sitemap__tooltip-row"><span class="visual-sitemap__tooltip-label">' + t('reports.crawler.nodeDepth', 'Depth') + '</span><span class="visual-sitemap__tooltip-value">' + (nodeData.depth || 0) + '</span></div>' +
      '<div class="visual-sitemap__tooltip-row"><span class="visual-sitemap__tooltip-label">Section</span><span class="visual-sitemap__tooltip-value">/' + escapeHtml(section) + '/</span></div>' +
      '<div class="visual-sitemap__tooltip-row"><span class="visual-sitemap__tooltip-label">' + t('reports.crawler.nodeChildren', 'Children') + '</span><span class="visual-sitemap__tooltip-value">' + childCount + '</span></div>' +
      (desc > 0 ? '<div class="visual-sitemap__tooltip-row"><span class="visual-sitemap__tooltip-label">' + t('reports.crawler.nodeDescendants', 'Descendants') + '</span><span class="visual-sitemap__tooltip-value">' + desc + '</span></div>' : '') +
      '<div style="margin-top:4px;font-size:10px;color:var(--color-text-muted);">' + t('reports.crawler.clickToInspect', 'Click to inspect') + '</div>';

    tip.classList.add('visual-sitemap__tooltip--visible');
    positionTooltip(tip, event);
  }

  function hideTooltip(state) {
    var tip = state.el.querySelector('[data-vs-tooltip]');
    if (tip) tip.classList.remove('visual-sitemap__tooltip--visible');
  }

  function positionTooltip(tip, event) {
    var x = event.pageX || (event.clientX + window.scrollX);
    var y = event.pageY || (event.clientY + window.scrollY);
    var pad = 12;
    var vw = window.innerWidth;
    var vh = window.innerHeight;

    // Position relative to viewport
    var left = event.clientX + pad;
    var top = event.clientY + pad;
    if (left + 320 > vw) left = event.clientX - 320 - pad;
    if (top + 200 > vh) top = event.clientY - 200 - pad;

    tip.style.left = left + 'px';
    tip.style.top = top + 'px';
  }

  /* ====================================================================
     Inspector panel
     ==================================================================== */
  function openInspector(state, nodeData) {
    var inspector = state.el.querySelector('[data-vs-inspector]');
    var body = state.el.querySelector('[data-vs-inspector-body]');
    if (!inspector || !body) return;

    var pt = nodeData.pageType || {};
    var childCount = nodeData.children ? nodeData.children.length : 0;
    var desc = countDescendants(nodeData);

    body.innerHTML =
      '<div class="visual-sitemap__inspector-field">' +
        '<div class="visual-sitemap__inspector-field-label">' + t('reports.crawler.nodeUrl', 'URL') + '</div>' +
        '<div class="visual-sitemap__inspector-field-value">' +
          (nodeData.url ? '<a href="' + escapeHtml(nodeData.url) + '" target="_blank" rel="noopener">' + escapeHtml(nodeData.url) + '</a>' : escapeHtml(nodeData.path || nodeData.name)) +
        '</div>' +
      '</div>' +
      '<div class="visual-sitemap__inspector-field">' +
        '<div class="visual-sitemap__inspector-field-label">' + t('reports.crawler.nodeType', 'Type') + '</div>' +
        '<div class="visual-sitemap__inspector-field-value">' + (pt.icon || '') + ' ' + (pt.label || 'Page') + '</div>' +
      '</div>' +
      '<div class="visual-sitemap__inspector-field">' +
        '<div class="visual-sitemap__inspector-field-label">' + t('reports.crawler.nodeDepth', 'Depth') + '</div>' +
        '<div class="visual-sitemap__inspector-field-value">' + (nodeData.depth || 0) + '</div>' +
      '</div>' +
      '<div class="visual-sitemap__inspector-field">' +
        '<div class="visual-sitemap__inspector-field-label">' + t('reports.crawler.nodeChildren', 'Children') + '</div>' +
        '<div class="visual-sitemap__inspector-field-value">' + childCount + '</div>' +
      '</div>' +
      (desc > 0 ?
      '<div class="visual-sitemap__inspector-field">' +
        '<div class="visual-sitemap__inspector-field-label">' + t('reports.crawler.nodeDescendants', 'Descendants') + '</div>' +
        '<div class="visual-sitemap__inspector-field-value">' + desc + '</div>' +
      '</div>' : '');

    inspector.classList.add('visual-sitemap__inspector--open');
    state.inspectorOpen = true;
  }

  function closeInspector(state) {
    var inspector = state.el.querySelector('[data-vs-inspector]');
    if (inspector) inspector.classList.remove('visual-sitemap__inspector--open');
    state.inspectorOpen = false;
  }

  /* ====================================================================
     Scroll-to page item in Discovered Pages
     ==================================================================== */
  function scrollToPageItem(nodeData) {
    if (!nodeData.url) return;
    var urlLower = nodeData.url.toLowerCase();
    var items = document.querySelectorAll('.page-item[data-url]');
    for (var i = 0; i < items.length; i++) {
      if (items[i].getAttribute('data-url') === urlLower) {
        // Remove previous highlights
        document.querySelectorAll('.page-item--highlighted').forEach(function (el) {
          el.classList.remove('page-item--highlighted');
        });
        items[i].classList.add('page-item--highlighted');
        items[i].scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Remove after animation
        setTimeout(function () {
          items[i].classList.remove('page-item--highlighted');
        }, 2000);
        break;
      }
    }
  }

  /* ====================================================================
     Simulation cleanup
     ==================================================================== */
  function stopSimulation(state) {
    if (state.simulation) {
      state.simulation.stop();
      state.simulation = null;
    }
  }

  /* ====================================================================
     Destroy (cleanup)
     ==================================================================== */
  function destroy(containerId) {
    var id = containerId || 'main';
    var state = instances[id];
    if (!state) return;

    stopSimulation(state);
    if (state.themeObserver) {
      state.themeObserver.disconnect();
      state.themeObserver = null;
    }
    var canvasEl = state.el ? state.el.querySelector('[data-vs-canvas]') : null;
    if (canvasEl) canvasEl.innerHTML = '';
    delete instances[id];
  }

  /* ====================================================================
     Utility
     ==================================================================== */
  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ====================================================================
     Expose public API
     ==================================================================== */
  window.VisualSitemap = {
    renderPlaceholder: renderPlaceholder,
    init: init,
    destroy: destroy
  };
})();
