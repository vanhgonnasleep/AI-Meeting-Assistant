/**
 * Group meeting records into chronological buckets:
 * Today, Yesterday, Previous 7 Days, Older.
 * 
 * Used by Sidebar to minimize cognitive load and provide quick
 * temporal navigation for past meetings.
 */
export const groupMeetingsByDate = (meetings = []) => {
  const groups = {
    today: [],
    yesterday: [],
    pastWeek: [],
    older: [],
  };

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 86400000;
  const startOfPastWeek = startOfToday - 7 * 86400000;

  meetings.forEach((m) => {
    if (!m || !m.created_at) {
      groups.older.push(m);
      return;
    }
    const t = new Date(m.created_at).getTime();
    if (isNaN(t)) {
      groups.older.push(m);
    } else if (t >= startOfToday) {
      groups.today.push(m);
    } else if (t >= startOfYesterday) {
      groups.yesterday.push(m);
    } else if (t >= startOfPastWeek) {
      groups.pastWeek.push(m);
    } else {
      groups.older.push(m);
    }
  });

  return groups;
};
