__version__ = "0.1.0"

_DATASET_ATTRS = {"get_dataset", "submit_predictions", "Dataset", "DatasetError", "ValidationError"}


def __getattr__(name: str):
    if name in _DATASET_ATTRS:
        from reinfo import dataset

        return getattr(dataset, name)
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
