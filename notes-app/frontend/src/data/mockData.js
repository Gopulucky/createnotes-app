// Use this file to define your courses and topics.
// You can add as many modules and topics as you want.
export const courseData = [
  {
    id: "module-1",
    title: "Your First Course Module", // e.g., "Computer Networks"
    topics: [
      { id: "topic-1", title: "Your First Topic", difficulty: "easy" },
      { id: "topic-2", title: "Your Second Topic", difficulty: "medium" },
      { id: "topic-3", title: "Your Third Topic", difficulty: "hard" },
    ]
  },
  {
    id: "module-2",
    title: "Your Second Course Module", // e.g., "Operating Systems"
    topics: [
      { id: "topic-4", title: "Another Topic", difficulty: "easy" },
    ]
  }
];

// Helper to flat map topics for prev/next navigation
export const flatTopics = courseData.flatMap(m => m.topics);
