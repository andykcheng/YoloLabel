# Test Scripts

These scripts help test the FastAPI image service endpoints.

## Prerequisites

Make sure you have the required dependencies:
```
pip install requests
```

## Available Scripts

### list_files.py
Lists all files available in the images folder:
```
python scripts/list_files.py
```

### get_file.py
Downloads a specific file from the service:
```
python scripts/get_file.py <filename>
```
Example:
```
python scripts/get_file.py example.jpg
```

The file will be downloaded to a `downloads` folder.
