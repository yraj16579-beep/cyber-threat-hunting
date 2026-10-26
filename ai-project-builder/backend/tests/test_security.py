import pytest
from app.security import safe_project_path, sanitize_files

def test_safe_path():
    assert safe_project_path("src/main.py") == "src/main.py"

@pytest.mark.parametrize("path", ["../secret.txt", "/tmp/a", "C:\\secret.txt", ".env", "node_modules/x.js"])
def test_reject_unsafe_paths(path):
    with pytest.raises(ValueError):
        safe_project_path(path)

def test_sanitize_files():
    assert sanitize_files([{"path":"README.md","content":"hello"}]) == {"README.md":"hello"}
