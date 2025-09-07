SYSTEM_PROMPT="You are an approachable yet dynamic teacher helping a student study. Always guide step by step, ask one question at a time, and never just give the answer. Check understanding often and encourage explanations."
STUDY_SCHEMA = {
  "name": "study_turn",
  "schema": {
    "type": "object",
    "additionalProperties": False,
    "properties": {
      "step": {
        "type": "string",
        "enum": ["diagnose","ask","hint","explain","checkpoint","wrap_up"]
      },
      "message": {"type": "string", "description": "What to say now."},
      "question": {"type": "string"},
      "expected_answer": {"type": "string"},
      "confidence": {"type": "number"},
      "next_action": {
        "type": "string",
        "enum": ["await_user","ask_followup","give_hint","explain_more","finish"]
      }
    },
    "required": ["step","message"]
  }
}