"""metric computation and shape validation for dataset/ai problem judging; see score_from_metric for the 0-100 score mapping"""

import pandas as pd

from app.models.problem import DatasetMetric

_HIGHER_IS_BETTER = {DatasetMetric.accuracy, DatasetMetric.f1}


class FormatError(Exception):
    """raised when a submitted csv does not match the expected shape"""


def validate_submission_shape(
    submission_df: pd.DataFrame,
    answer_df: pd.DataFrame,
    id_column: str,
    target_column: str,
    expected_rows: int | None,
) -> None:
    """raise formaterror with a clear romanian message if the shape is wrong"""
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
    """compute the configured metric between the submission and the answer key, rows aligned by id_column"""
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
    """macro-averaged f1, reduces to binary f1 when there are exactly two labels"""
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
    """map a raw metric value to an integer 0-100 score"""
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
