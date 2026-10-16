"""Conservative calendar normalization; unknown business dates stay unknown."""
import calendar
import re
import unicodedata
from datetime import date, datetime, timedelta


def normalize_deadline_to_iso(text: str, reference_date: datetime, *, sprint_end=None):
    if not isinstance(text, str) or not text.strip():
        return None
    value = unicodedata.normalize('NFC', text).casefold().strip().rstrip('.')
    value = re.sub(r'^(?:by|before|due|trước|vào)\s+', '', value)
    today = reference_date.date() if isinstance(reference_date, datetime) else reference_date
    if not isinstance(today, date):
        raise ValueError('reference_date must be a calendar date')
    for pattern in ('%Y-%m-%d', '%d/%m/%Y'):
        try:
            return datetime.strptime(value, pattern).date().isoformat()
        except ValueError:
            pass
    if value in ('today', 'hôm nay'):
        return today.isoformat()
    if value in ('tomorrow', 'ngày mai'):
        return (today + timedelta(days=1)).isoformat()
    if value in ('day after tomorrow', 'ngày kia'):
        return (today + timedelta(days=2)).isoformat()
    if value in ('cuối tháng', 'end of month', 'end of the month'):
        return today.replace(day=calendar.monthrange(today.year, today.month)[1]).isoformat()
    if value in ('end of sprint', 'end of the sprint', 'cuối sprint'):
        if sprint_end is None:
            return None
        return (sprint_end.date() if isinstance(sprint_end, datetime) else sprint_end).isoformat()
    weekdays = ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')
    match = re.fullmatch(r'(?:(next|this)\s+)?(' + '|'.join(weekdays) + r')(?:\s+(?:morning|afternoon|evening))?', value)
    if match:
        target = weekdays.index(match[2])
        if match[1] == 'next':
            delta = 7 - today.weekday() + target
        elif match[1] == 'this':
            delta = target - today.weekday()
        else:
            delta = (target - today.weekday()) % 7
        return (today + timedelta(days=delta)).isoformat()
    match = re.fullmatch(r'(?:thứ\s*([2-7])|(chủ nhật))(?:\s+(?:tuần\s+)?(này|sau|tới))?(?:\s+(?:sáng|chiều|tối))?', value)
    if match:
        target = int(match[1]) - 2 if match[1] else 6
        delta = (target - today.weekday()) % 7
        if match[3] == 'này':
            delta = target - today.weekday()
        elif match[3] in ('sau', 'tới'):
            delta = 7 - today.weekday() + target
        return (today + timedelta(days=delta)).isoformat()
    return None
