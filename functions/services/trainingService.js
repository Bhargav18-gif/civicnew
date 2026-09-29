const { inspectModelArtifacts } = require('./modelService');

/**
 * Requirement 9: GET /api/admin/ai/training/runs
 * Reads verified training run documents from Firestore.
 */
async function getTrainingRuns(db) {
  try {
    const snap = await db.collection('ai_training_runs')
      .orderBy('startedAt', 'desc')
      .limit(50)
      .get();

    const runs = snap.docs.map(d => ({
      id: d.id,
      jobId: d.data().jobId || d.id,
      datasetVersion: d.data().datasetVersion || '10000-stratified-v1',
      baseModel: d.data().baseModel || 'distilbert-base-uncased',
      status: d.data().status || 'IDLE',
      startedAt: d.data().startedAt || null,
      completedAt: d.data().completedAt || null,
      metrics: d.data().metrics || null,
      candidateModelVersion: d.data().candidateModelVersion || null,
      error: d.data().error || null
    }));

    return {
      success: true,
      runs
    };
  } catch (err) {
    // If empty or index not created, return empty runs array without crashing
    return {
      success: true,
      runs: []
    };
  }
}

/**
 * Requirement 10: GET /api/admin/ai/training-status
 * Inspects real training state and actual model health.
 */
async function getTrainingStatus(db) {
  const artifacts = inspectModelArtifacts();

  let activeJobId = null;
  let status = 'IDLE';

  try {
    const activeSnap = await db.collection('ai_training_runs')
      .where('status', '==', 'RUNNING')
      .limit(1)
      .get();

    if (!activeSnap.empty) {
      status = 'RUNNING';
      activeJobId = activeSnap.docs[0].id;
    }
  } catch (e) {
    console.warn('[TRAINING SERVICE] Active job query notice:', e.message);
  }

  const modelHealth = artifacts.weightsExist ? 'READY' : 'MODEL_UNAVAILABLE';

  return {
    success: true,
    status,
    activeJobId,
    productionModelVersion: artifacts.weightsExist ? (artifacts.registry?.active_production_version || 'civicconnect-admin-v1') : null,
    modelHealth,
    // Compatibility fields for existing dashboard cards
    last_run: artifacts.registry?.versions?.['civicconnect-admin-v1']?.training_date || null,
    training_dataset_size: 10000,
    min_required_feedback_examples: 10
  };
}

/**
 * Asynchronously queues a training run in Firestore.
 */
async function queueTrainingRun(db, user, options = {}) {
  const jobId = `job-${Date.now()}`;
  const now = new Date().toISOString();

  const runDoc = {
    jobId,
    datasetVersion: options.datasetVersion || '10000-stratified-v1',
    baseModel: 'distilbert-base-uncased',
    status: 'QUEUED',
    startedAt: now,
    completedAt: null,
    triggeredBy: user?.uid || 'admin',
    metrics: null,
    candidateModelVersion: null,
    error: null
  };

  await db.collection('ai_training_runs').doc(jobId).set(runDoc);

  return {
    success: true,
    jobId,
    status: 'QUEUED',
    message: 'Training job queued successfully. Background training worker will process dataset.'
  };
}

module.exports = {
  getTrainingRuns,
  getTrainingStatus,
  queueTrainingRun
};
