"""CTF challenge scoring: static base points, or a decaying dynamic curve.

Dynamic scoring follows a CTFd-style quadratic decay: a challenge is worth
base_points for the first solve and decays down to a fixed floor
(_DYNAMIC_FLOOR_RATIO of base_points) by the _DYNAMIC_DECAY_SOLVES-th solve,
staying at the floor after that. Points are computed once, at solve time,
from the number of solves recorded so far - earlier solvers keep the
points_awarded value they were given; it is never retroactively reduced when
later solves push the challenge's current value down further.
"""

from app.models.ctf import CtfScoring

_DYNAMIC_FLOOR_RATIO = 0.5
_DYNAMIC_DECAY_SOLVES = 10


def current_value(base_points: int, scoring: CtfScoring, solve_count: int) -> int:
    """Points a new solver would receive right now, given solve_count prior solves."""
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
    """Points actually awarded to a solver, after subtracting hints they revealed."""
    raw = current_value(base_points, scoring, solves_before)
    return max(0, raw - hint_cost_spent)
