from flask import Flask, jsonify, request, render_template

app = Flask(__name__)
app.url_map.strict_slashes = False

entries = []
next_id = 1

# Simple ML fallback and optional sklearn model
try:
    from sklearn.feature_extraction.text import CountVectorizer
    from sklearn.linear_model import LogisticRegression
    import numpy as np
    sklearn_available = True
except ImportError:
    sklearn_available = False

vectorizer = None
model = None

CATEGORY_CLASSES = ["Student", "Professional", "Retired", "Other"]


def train_model():
    global vectorizer, model
    if not sklearn_available:
        return

    samples = [
        ("student learner school", 18, "Student"),
        ("college student intern", 22, "Student"),
        ("software engineer developer", 28, "Professional"),
        ("teacher manager nurse", 32, "Professional"),
        ("doctor lawyer consultant", 40, "Professional"),
        ("retired senior pension", 67, "Retired"),
        ("grandparent retired", 72, "Retired"),
        ("unemployed hobbyist", 45, "Other"),
    ]

    texts = [text for text, _, _ in samples]
    ages = [[age] for _, age, _ in samples]
    labels = [label for _, _, label in samples]

    vectorizer = CountVectorizer()
    text_features = vectorizer.fit_transform(texts).toarray()

    X = np.hstack([text_features, np.array(ages)])
    model = LogisticRegression(max_iter=200)
    model.fit(X, labels)


def predict_category(name: str, age: int, occupation: str) -> str:
    text = f"{name} {occupation}".strip().lower()
    if sklearn_available and model is not None and vectorizer is not None:
        features = vectorizer.transform([text]).toarray()
        X = np.hstack([features, [[age]]])
        return model.predict(X)[0]

    # Fallback rule-based prediction
    if age < 25 or "student" in occupation.lower() or "intern" in occupation.lower():
        return "Student"
    if age >= 60 or "retired" in occupation.lower() or "pension" in occupation.lower():
        return "Retired"
    if any(keyword in occupation.lower() for keyword in ["engineer", "developer", "manager", "teacher", "doctor", "lawyer", "consultant"]):
        return "Professional"
    return "Other"


def find_entry(entry_id):
    return next((item for item in entries if item["id"] == entry_id), None)


@app.before_request
def log_request():
    app.logger.debug(f"Incoming {request.method} {request.path}")


@app.route("/")
def home():
    return render_template("index.html")


@app.route("/api/entries", methods=["GET"])
def get_entries():
    return jsonify(entries)


@app.route("/api/entries", methods=["POST"])
def create_entry():
    global next_id
    data = request.json or {}
    name = data.get("name", "").strip()
    age = int(data.get("age", 0) or 0)
    occupation = data.get("occupation", "").strip()

    if not name or age <= 0 or not occupation:
        return jsonify({"error": "Name, age, and occupation are required."}), 400

    category = predict_category(name, age, occupation)
    entry = {
        "id": next_id,
        "name": name,
        "age": age,
        "occupation": occupation,
        "category": category,
    }
    entries.append(entry)
    next_id += 1
    return jsonify(entry), 201


@app.route("/api/entries/<int:entry_id>", methods=["PUT"])
def update_entry(entry_id):
    entry = find_entry(entry_id)
    if not entry:
        return jsonify({"error": "Entry not found."}), 404

    data = request.json or {}
    name = data.get("name", entry["name"]).strip()
    age = int(data.get("age", entry["age"]))
    occupation = data.get("occupation", entry["occupation"]).strip()

    if not name or age <= 0 or not occupation:
        return jsonify({"error": "Name, age, and occupation are required."}), 400

    entry["name"] = name
    entry["age"] = age
    entry["occupation"] = occupation
    entry["category"] = predict_category(name, age, occupation)
    return jsonify(entry)


@app.route("/api/entries/<int:entry_id>", methods=["DELETE"])
def delete_entry(entry_id):
    entry = find_entry(entry_id)
    if not entry:
        return jsonify({"error": "Entry not found."}), 404

    entries.remove(entry)
    return jsonify({"success": True})


if __name__ == "__main__":
    train_model()
    app.run(debug=True)
