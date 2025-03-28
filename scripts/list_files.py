#!/usr/bin/env python3
"""
Script to test the /list_files endpoint of the Image Files API
"""

import requests
import json

def main():
    """Test the /list_files endpoint and print the results"""
    try:
        # Send a GET request to the /list_files endpoint
        response = requests.get("http://localhost:8000/list_files")
        
        # Print the status code
        print(f"Status code: {response.status_code}")
        
        # If the request was successful, print the files
        if response.status_code == 200:
            files = response.json()
            if files:
                print("Files in the images folder:")
                for file in files:
                    print(f"- {file}")
            else:
                print("No files found in the images folder.")
        else:
            print(f"Error: {response.text}")
    except requests.exceptions.ConnectionError:
        print("Error: Could not connect to the server. Make sure the API is running.")
    except Exception as e:
        print(f"An error occurred: {str(e)}")

if __name__ == "__main__":
    main()
