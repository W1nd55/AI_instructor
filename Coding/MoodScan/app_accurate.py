"""Local MoodScan journal analyzer.

Run with: streamlit run app_accurate.py
The original notebook, dataset, and app.py are left untouched. This version
evaluates a stronger classifier on a stratified holdout and then trains it on
the full dataset locally.
"""

from pathlib import Path
import re

import pandas as pd
import streamlit as st
import streamlit.components.v1 as components
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, f1_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.pipeline import FeatureUnion

editor_component = components.declare_component(
    "moodscan_rich_editor", path=str(Path(__file__).with_name("moodscan_editor")),
)


DATA_PATH = Path(__file__).with_name("emotion_dataset_2.csv")
CONFIDENCE_THRESHOLD = 0.30
EMOTION_COLORS = {
    "joy": "#F3D58A",
    "sadness": "#C9DDF7",
    "anger": "#F7C8C4",
    "fear": "#DDD2F4",
    "surprise": "#F2D1E3",
    "disgust": "#CDE8D9",
    "shame": "#EAD5CA",
    "neutral": "#E7EAE7",
    "inconclusive": "#ECEEEB",
}
EMOTION_MARKS = {
    "joy": "☀", "sadness": "◒", "anger": "ϟ", "fear": "◉",
    "surprise": "✳", "disgust": "⌁", "shame": "◌", "neutral": "—",
}

st.set_page_config(page_title="MoodScan", page_icon="◒", layout="wide")
st.markdown("""
<style>
@import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:wght@400;500;600;700&family=Manrope:wght@400;500;600;700;800&display=swap');
:root { --ink:#25322d; --muted:#828b85; --paper:#fbfbf8; --green:#426b59; }
.stApp { background:var(--paper); color:var(--ink); font-family:'DM Sans',sans-serif; }
.block-container { max-width:1040px; padding:1.25rem 2.2rem 5rem; }
header[data-testid="stHeader"] { background:transparent; }
.brand { color:var(--green); font:600 14px 'DM Mono',monospace; letter-spacing:.13em; text-transform:uppercase; margin:5px 0 96px; }
.hero { max-width:700px; margin:0 auto; text-align:center; }
.hero-title { font:600 clamp(35px,5vw,54px) 'Manrope',sans-serif; letter-spacing:-.06em; line-height:1.12; margin:0 0 16px; }
.hero-sub { color:var(--muted); font-size:16px; margin-bottom:48px; }
.try-now { color:var(--green); text-transform:uppercase; letter-spacing:.16em; font:500 11px 'DM Mono',monospace; margin-bottom:14px; }
.writing-hint { text-align:center; color:#9aa29c; font:11px 'DM Mono',monospace; margin:8px 0 0; }
.right-panel { background:#fff; border:1px solid #e9ebe5; border-radius:18px; padding:22px; margin-top:4px; }
.panel-eyebrow { color:#879089; font:500 10px 'DM Mono',monospace; text-transform:uppercase; letter-spacing:.14em; }
.mood-name { font:650 32px 'Manrope',sans-serif; letter-spacing:-.05em; text-transform:capitalize; margin:8px 0 2px; }
.mood-note { color:#879089; font-size:12px; line-height:1.6; }
.sentence-row { padding:13px 0; border-bottom:1px solid #eef0eb; }
.sentence-row:last-child { border-bottom:0; }
.sentence-preview { color:#55615a; font-size:12px; line-height:1.5; margin:0 0 7px; }
.sentence-mood { font:500 10px 'DM Mono',monospace; text-transform:uppercase; letter-spacing:.07em; }
.legend { display:flex; flex-wrap:wrap; gap:7px 10px; margin-top:17px; }
.legend-item { font:10px 'DM Mono',monospace; color:#69746d; text-transform:capitalize; }
.empty-panel { background:#fff; border:1px solid #e9ebe5; border-radius:18px; padding:22px; color:#9aa29c; font-size:13px; line-height:1.6; }
.footer-note { text-align:center; color:#9aa29c; font-size:11px; margin-top:40px; }
footer {visibility:hidden;}
</style>
""", unsafe_allow_html=True)


@st.cache_resource(show_spinner="Preparing the local emotion model…")
def load_model():
    if not DATA_PATH.exists():
        raise FileNotFoundError(f"Dataset not found: {DATA_PATH}")
    data = pd.read_csv(DATA_PATH)
    if not {"Emotion", "Text"}.issubset(data.columns):
        raise ValueError("The dataset needs Emotion and Text columns.")
    data = data.dropna(subset=["Emotion", "Text"])
    texts = data["Clean_Text"].fillna("").astype(str) if "Clean_Text" in data else data["Text"].astype(str)
    empty = texts.str.strip().eq("")
    texts.loc[empty] = data.loc[empty, "Text"].astype(str)
    labels = data["Emotion"].astype(str)
    train_idx, test_idx = train_test_split(
        range(len(data)), test_size=0.2, random_state=42, stratify=labels
    )

    def make_model():
        features = FeatureUnion([
            ("word", TfidfVectorizer(
                ngram_range=(1, 2), max_features=100000, sublinear_tf=True,
            )),
            ("character", TfidfVectorizer(
                analyzer="char_wb", ngram_range=(3, 5), min_df=2,
                max_features=70000, sublinear_tf=True,
            )),
        ])
        classifier = LogisticRegression(
            C=4, class_weight="balanced", max_iter=500, solver="liblinear",
        )
        return Pipeline([("features", features), ("classifier", classifier)])

    # Measure performance on examples the model has not trained on.
    evaluation_model = make_model()
    evaluation_model.fit(texts.iloc[list(train_idx)], labels.iloc[list(train_idx)])
    test_predictions = evaluation_model.predict(texts.iloc[list(test_idx)])
    metrics = {
        "accuracy": accuracy_score(labels.iloc[list(test_idx)], test_predictions),
        "macro_f1": f1_score(labels.iloc[list(test_idx)], test_predictions, average="macro"),
        "test_size": len(test_idx),
    }

    # Refit the selected model on all available labeled data for use in the app.
    model = make_model()
    model.fit(texts, labels)
    return model, data, metrics


def split_sentences(text):
    return [s.strip() for s in re.split(r"(?<=[.!?])\s+|\n+", text.strip()) if s.strip()]


def score_text(model, text):
    probabilities = model.predict_proba([text])[0]
    classes = model.classes_
    return sorted(zip(classes, probabilities), key=lambda pair: pair[1], reverse=True)


def get_sentence_spans(text):
    """Return sentence boundaries and model estimates without losing spacing."""
    results = []
    for match in re.finditer(r"[^.!?\n]+(?:[.!?]+|$)", text):
        raw = match.group()
        sentence = raw.strip()
        if not sentence:
            continue
        left = len(raw) - len(raw.lstrip())
        start = match.start() + left
        end = start + len(sentence)
        probabilities = model.predict_proba([sentence])[0]
        ranked = sorted(zip(model.classes_, probabilities), key=lambda pair: pair[1], reverse=True)
        results.append({
            "text": sentence,
            "start": start,
            "end": end,
            "emotion": ranked[0][0] if ranked[0][1] >= CONFIDENCE_THRESHOLD else "inconclusive",
            "score": float(ranked[0][1]),
            "ranked": ranked,
            "probabilities": probabilities,
        })
    return results


def js_offset(text, python_offset):
    """Convert a Python character offset to a browser UTF-16 string offset."""
    return len(text[:python_offset].encode("utf-16-le")) // 2


try:
    model, data, metrics = load_model()
except Exception as exc:
    st.error(f"MoodScan couldn’t prepare the model: {exc}")
    st.stop()

st.markdown('<div class="brand">MOODSCAN</div>', unsafe_allow_html=True)
st.markdown('<div class="hero"><div class="hero-title">Analyze the mood from your journal entries in text</div><div class="hero-sub">Try now · Write freely and see each sentence get a mood highlight.</div></div>', unsafe_allow_html=True)

if "moodscan_journal_text" not in st.session_state:
    st.session_state.moodscan_journal_text = ""
# Streamlit stores the latest custom-component value under its widget key
# before rerunning the script. Read it here so one line commit produces just
# one app pass and the editor receives fresh highlights immediately.
component_state = st.session_state.get("moodscan_rich_editor")
if isinstance(component_state, dict) and isinstance(component_state.get("text"), str):
    st.session_state.moodscan_journal_text = component_state["text"]
prior_text = st.session_state.moodscan_journal_text
sentence_results = get_sentence_spans(prior_text) if prior_text.strip() else []
segments = [
    {
        "start": js_offset(prior_text, item["start"]),
        "end": js_offset(prior_text, item["end"]),
        "emotion": item["emotion"],
        "color": EMOTION_COLORS.get(item["emotion"], "#E7EAE7"),
    }
    for item in sentence_results
]

left_col, right_col = st.columns([1.65, .85], gap="large", vertical_alignment="top")
with left_col:
    editor_result = editor_component(
        text=prior_text,
        segments=segments,
        placeholder="Start typing your journal entry…",
        key="moodscan_rich_editor",
        default={"text": prior_text},
    )
    st.markdown('<div class="writing-hint">PRESS ENTER TO ANALYZE A COMPLETED LINE</div>', unsafe_allow_html=True)

journal = editor_result.get("text", prior_text) if isinstance(editor_result, dict) else prior_text
if journal != prior_text:
    st.session_state.moodscan_journal_text = journal
    sentence_results = get_sentence_spans(journal) if journal.strip() else []

with right_col:
    if sentence_results:
        import numpy as np

        sentence_probabilities = [item["probabilities"] for item in sentence_results]
        mean_probabilities = np.mean(sentence_probabilities, axis=0)
        ranked_overall = sorted(zip(model.classes_, mean_probabilities), key=lambda pair: pair[1], reverse=True)
        top_emotion, overall_score = ranked_overall[0]
        overall_emotion = top_emotion if overall_score >= CONFIDENCE_THRESHOLD else "inconclusive"
        overall_color = EMOTION_COLORS.get(overall_emotion, "#E7EAE7")
        st.markdown(
            f'<div class="right-panel"><div class="panel-eyebrow">Mood in this entry</div>'
            f'<div class="mood-name" style="color:#38443e;text-transform:capitalize">{overall_emotion}</div>'
            f'<div class="mood-note">{("No emotion reached 30%" if overall_emotion == "inconclusive" else "Leading mood")} · {overall_score:.0%} relative model score</div>'
            f'<div class="legend">' + "".join(
                f'<span class="legend-item"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:{EMOTION_COLORS.get(emotion, "#E7EAE7")};margin-right:4px"></span>{emotion}</span>'
                for emotion, _ in ranked_overall[:4]
            ) + '</div></div>',
            unsafe_allow_html=True,
        )
        st.markdown('<div class="right-panel"><div class="panel-eyebrow">Sentence by sentence · under 30% is inconclusive</div>', unsafe_allow_html=True)
        for item in sentence_results:
            emotion = item["emotion"]
            color = EMOTION_COLORS.get(emotion, "#E7EAE7")
            preview = item["text"]
            if len(preview) > 82:
                preview = preview[:79].rstrip() + "…"
            safe_preview = (preview.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"))
            st.markdown(
                f'<div class="sentence-row"><div class="sentence-preview">{safe_preview}</div>'
                f'<span class="sentence-mood" style="color:#59655e"><span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:{color};margin-right:6px"></span>{emotion} · {item["score"]:.0%}</span></div>',
                unsafe_allow_html=True,
            )
        st.markdown('</div>', unsafe_allow_html=True)
    else:
        st.markdown('<div class="empty-panel">Your live mood summary and sentence labels will appear here as you write.</div>', unsafe_allow_html=True)

st.markdown('<div class="footer-note">Mood estimates are a reflection aid, not a diagnosis.</div>', unsafe_allow_html=True)
