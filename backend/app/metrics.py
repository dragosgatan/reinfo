"""Metric computation and shape validation for dataset/AI problem judging.

Score mapping: accuracy/f1 are already 0-1, so with no threshold they scale
directly to 0-100; with a threshold, reaching it scores 100 and below it
scales proportionally. rmse/mae are unbounded error metrics (lower is
better) and therefore require a threshold to map onto 0-100 - without one
they score 0. Reaching the threshold scores 100, and score falls off
linearly to 0 at 2x the threshold.
"""

import pandas as pd

from app.models.problem import DatasetMetric

_HIGHER_IS_BETTER = {DatasetMetric.accuracy, DatasetMetric.f1}


class FormatError(Exception):
    """Raised when a submitted CSV does not match the expected shape."""


def validate_submission_shape(
    submission_df: pd.DataFrame,
    answer_df: pd.DataFrame,
    id_column: str,
    target_column: str,
    expected_rows: int | None,
) -> None:
    """Raise FormatError with a clear Romanian message if the shape is wrong."""
    if id_column not in submission_df.columns:
        raise FormatError(f"Lipsește coloana '{id_column}'")
    if target_column not in submission_df.columns:
        raise FormatError(f"Lipsește coloana '{target_column}'")
    if expected_rows is not None and len(submission_df) != expected_rows:
        raise FormatError(
            f"Număr de rânduri greșit: așteptat {expected_rows}, primit {len(submission_df)}"
        )
    if submission_df[target_column].isna().any():
        raise FormatError(f"Coloana '{target_column}' conține valori lipsă (NaN)")
    if submission_df[id_column].duplicated().any():
        raise FormatError(f"Coloana '{id_column}' conține valori duplicate")

    submitted_ids = set(submission_df[id_column])
    expected_ids = set(answer_df[id_column])
    if submitted_ids != expected_ids:
        raise FormatError(f"Coloana '{id_column}' nu corespunde cu setul de test așteptat")


def compute_metric(
    metric: DatasetMetric,
    submission_df: pd.DataFrame,
    answer_df: pd.DataFrame,
    id_column: str,
    target_column: str,
) -> float:
    """Compute the configured metric between the submission and the answer key.

    Rows are aligned by id_column before comparison.
    """
    merged = submission_df[[id_column, target_column]].merge(
        answer_df[[id_column, target_column]], on=id_column, suffixes=("_pred", "_true")
    )
    y_pred = merged[f"{target_column}_pred"]
    y_true = merged[f"{target_column}_true"]

    if metric == DatasetMetric.accuracy:
        return float((y_pred == y_true).mean())
    if metric == DatasetMetric.f1:
        return _f1_score(y_true, y_pred)
    if metric == DatasetMetric.rmse:
        diff = y_pred.astype(float) - y_true.astype(float)
        return float((diff**2).mean() ** 0.5)
    if metric == DatasetMetric.mae:
        diff = y_pred.astype(float) - y_true.astype(float)
        return float(diff.abs().mean())
    raise ValueError(f"Unknown metric: {metric}")


def _f1_score(y_true: pd.Series, y_pred: pd.Series) -> float:
    """Macro-averaged F1 (reduces to binary F1 when there are exactly two labels)."""
    labels = set(y_true) | set(y_pred)
    if not labels:
        return 0.0

    scores = []
    for label in labels:
        tp = int(((y_pred == label) & (y_true == label)).sum())
        fp = int(((y_pred == label) & (y_true != label)).sum())
        fn = int(((y_pred != label) & (y_true == label)).sum())
        precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
        recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
        f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0.0
        scores.append(f1)
    return sum(scores) / len(scores)


def score_from_metric(metric: DatasetMetric, value: float, threshold: float | None) -> int:
    """Map a raw metric value to an integer 0-100 score. See module docstring."""
    if metric in _HIGHER_IS_BETTER:
        base = max(0.0, min(1.0, value))
        if threshold is None or threshold <= 0:
            return round(base * 100)
        if base >= threshold:
            return 100
        return round(base / threshold * 100)

    if threshold is None or threshold <= 0:
        return 0
    if value <= threshold:
        return 100
    ratio = value / threshold
    if ratio >= 2:
        return 0
    return round(100 * (2 - ratio))
