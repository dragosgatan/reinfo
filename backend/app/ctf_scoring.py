"""ctf challenge scoring: static base points, or a ctfd-style decaying dynamic curve, computed once at solve time"""

from app.models.ctf import CtfScoring

_DYNAMIC_FLOOR_RATIO = 0.5
_DYNAMIC_DECAY_SOLVES = 10


def current_value(base_points: int, scoring: CtfScoring, solve_count: int) -> int:
    """points a new solver would receive right now, given solve_count prior solves"""
    if scoring != CtfScoring.dynamic:
        return base_points
    floor = round(base_points * _DYNAMIC_FLOOR_RATIO)
    if solve_count <= 0:
        return base_points
    if solve_count >= _DYNAMIC_DECAY_SOLVES:
        return floor
    progress = (_DYNAMIC_DECAY_SOLVES - solve_count) / _DYNAMIC_DECAY_SOLVES
    value = floor + (base_points - floor) * progress**2
    return max(floor, round(value))


def compute_points(
    base_points: int, scoring: CtfScoring, solves_before: int, hint_cost_spent: int = 0
) -> int:
    """points actually awarded to a solver, after subtracting hints they revealed"""
    raw = current_value(base_points, scoring, solves_before)
    return max(0, raw - hint_cost_spent)
