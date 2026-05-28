import sys
import os

# Put the project root on the path so `from api.main import app` resolves the
# package correctly and all relative imports inside main.py work on Vercel.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from api.main import app  # noqa: E402  (must come after sys.path tweak)
from mangum import Mangum  # noqa: E402

# Vercel invokes this `handler` symbol for every incoming request.
handler = Mangum(app, lifespan="off")
