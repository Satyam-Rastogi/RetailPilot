from typing import List, Tuple
from sqlalchemy.orm import Query


def paginate_query(
    query: Query,
    page: int = 1,
    page_size: int = 100
) -> Tuple[List, int, int]:
    """
    Paginate a SQLAlchemy query.

    Args:
        query: SQLAlchemy query object
        page: Page number (1-indexed), defaults to 1
        page_size: Number of items per page, defaults to 100.
                  If 0, returns all data without pagination.

    Returns:
        tuple: (paginated_data, total_items, total_pages)
            - paginated_data: List of items for the requested page
            - total_items: Total number of items in the query
            - total_pages: Total number of pages available
    """
    if page_size <= 0:
        total_items = query.count()
        return query.all(), total_items, 1

    if page < 1:
        page = 1

    total_items = query.count()
    total_pages = (total_items + page_size - 1) // page_size
    skip = (page - 1) * page_size

    paginated_data = query.offset(skip).limit(page_size).all()

    return paginated_data, total_items, total_pages
