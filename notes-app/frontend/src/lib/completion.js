// A topic's progress is derived from the content actually filled in, not from a
// manual status the user has to remember to set. The three signals are exactly the
// three Learn steps on the topic page, so the ring in the sidebar and the
// "Step 2 of 3" caption can never disagree with each other.
export const COMPLETION_STEPS = ['keyConcepts', 'images', 'notes'];

export const EMPTY_COMPLETION = { keyConcepts: false, images: false, notes: false };

// How many of the three steps have content, 0..3.
export function filledCount(completion) {
  if (!completion) return 0;
  return COMPLETION_STEPS.reduce((n, key) => n + (completion[key] ? 1 : 0), 0);
}

// 0..1 — what fraction of a topic is filled in. Drives the sidebar ring.
export function topicFraction(completion) {
  return filledCount(completion) / COMPLETION_STEPS.length;
}

// A topic counts as done only when all three steps have content.
export function isTopicComplete(completion) {
  return filledCount(completion) === COMPLETION_STEPS.length;
}

// Whole-course percentage: the share of topics that are fully filled in.
// Returns a rounded 0..100.
export function coursePercent(course, completionState) {
  const topics = (course.modules || []).flatMap(m => m.topics || []);
  if (topics.length === 0) return 0;
  const done = topics.filter(t => isTopicComplete(completionState[t.id])).length;
  return Math.round((done / topics.length) * 100);
}

// Coarse state used for icon colour and dashboard pills.
export function topicStatus(completion) {
  const n = filledCount(completion);
  if (n === COMPLETION_STEPS.length) return 'complete';
  return n > 0 ? 'partial' : 'empty';
}
