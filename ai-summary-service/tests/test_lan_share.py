from database.share import create_share_token, get_shared_meeting, revoke_share_token
from database.crud import create_meeting


def test_create_and_access_share_token():
    meeting_id = create_meeting(
        filename="LAN_Share_Test.mp3",
        raw_transcript="Speaker 1: Testing local network share.",
        executive_summary="- Validated LAN share mechanism.",
        action_items=[],
        duration=60.0
    )
    assert meeting_id is not None

    share_info = create_share_token(meeting_id, hours_valid=2)
    token = share_info["token"]
    assert len(token) > 20

    record = get_shared_meeting(token)
    assert record is not None
    assert record.filename == "LAN_Share_Test.mp3"

    # Revocation test
    revoked = revoke_share_token(token)
    assert revoked is True
    assert get_shared_meeting(token) is None
