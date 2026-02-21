/**
 * Feedback Service
 * Thumbs up/down on recommendations to weight ordering over time
 */

const { getDatabase } = require('../db');
const { createLogger } = require('../utils/logger');

const logger = createLogger('FeedbackService');

/**
 * Submit feedback — upsert vote, return updated aggregates
 */
async function submitFeedback({ reportId, recommendationId, recommendationType, userId, anonId, vote }) {
  if (!reportId || !recommendationId || ![-1, 1].includes(vote)) {
    throw new Error('Invalid feedback parameters');
  }

  if (!userId && !anonId) {
    throw new Error('Either userId or anonId is required');
  }

  const db = getDatabase();

  try {
    if (userId) {
      // Upsert by userId
      await db.run(
        `INSERT INTO recommendation_feedback (report_id, recommendation_id, recommendation_type, user_id, vote, updated_at)
         VALUES (?, ?, ?, ?, ?, datetime('now'))
         ON CONFLICT(report_id, recommendation_id, user_id)
         DO UPDATE SET vote = ?, updated_at = datetime('now')`,
        [reportId, recommendationId, recommendationType || 'static', userId, vote, vote]
      );
    } else {
      // Upsert by anonId
      await db.run(
        `INSERT INTO recommendation_feedback (report_id, recommendation_id, recommendation_type, anon_id, vote, updated_at)
         VALUES (?, ?, ?, ?, ?, datetime('now'))
         ON CONFLICT(report_id, recommendation_id, anon_id)
         DO UPDATE SET vote = ?, updated_at = datetime('now')`,
        [reportId, recommendationId, recommendationType || 'static', anonId, vote, vote]
      );
    }

    // Return updated aggregates
    const aggregate = await db.get(
      `SELECT
         SUM(CASE WHEN vote = 1 THEN 1 ELSE 0 END) AS upvotes,
         SUM(CASE WHEN vote = -1 THEN 1 ELSE 0 END) AS downvotes,
         SUM(vote) AS net_score
       FROM recommendation_feedback
       WHERE recommendation_id = ?`,
      [recommendationId]
    );

    return {
      recommendationId,
      userVote: vote,
      upvotes: aggregate?.upvotes || 0,
      downvotes: aggregate?.downvotes || 0,
      netScore: aggregate?.net_score || 0,
    };
  } catch (error) {
    logger.error('Failed to submit feedback', { error: error.message, reportId, recommendationId });
    throw error;
  }
}

/**
 * Get a user's own votes for a report (for active-state rendering)
 */
async function getFeedbackForReport(reportId, userId, anonId) {
  if (!reportId) return {};

  const db = getDatabase();

  try {
    let rows;
    if (userId) {
      rows = await db.all(
        'SELECT recommendation_id, vote FROM recommendation_feedback WHERE report_id = ? AND user_id = ?',
        [reportId, userId]
      );
    } else if (anonId) {
      rows = await db.all(
        'SELECT recommendation_id, vote FROM recommendation_feedback WHERE report_id = ? AND anon_id = ?',
        [reportId, anonId]
      );
    } else {
      return {};
    }

    const votes = {};
    for (const row of rows) {
      votes[row.recommendation_id] = row.vote;
    }
    return votes;
  } catch (error) {
    logger.error('Failed to get feedback for report', { error: error.message, reportId });
    return {};
  }
}

/**
 * Bulk fetch aggregate scores for multiple recommendation IDs
 */
async function getAggregateScores(recommendationIds) {
  if (!recommendationIds || recommendationIds.length === 0) return {};

  const db = getDatabase();

  try {
    const placeholders = recommendationIds.map(() => '?').join(',');
    const rows = await db.all(
      `SELECT
         recommendation_id,
         SUM(CASE WHEN vote = 1 THEN 1 ELSE 0 END) AS upvotes,
         SUM(CASE WHEN vote = -1 THEN 1 ELSE 0 END) AS downvotes,
         SUM(vote) AS net_score
       FROM recommendation_feedback
       WHERE recommendation_id IN (${placeholders})
       GROUP BY recommendation_id`,
      recommendationIds
    );

    const scores = {};
    for (const row of rows) {
      scores[row.recommendation_id] = {
        upvotes: row.upvotes,
        downvotes: row.downvotes,
        netScore: row.net_score,
      };
    }
    return scores;
  } catch (error) {
    logger.error('Failed to get aggregate scores', { error: error.message });
    return {};
  }
}

module.exports = {
  submitFeedback,
  getFeedbackForReport,
  getAggregateScores,
};
