import json
import csv
import re
import os

def extract_flashcard_data(ts_file_path):
    """
    Extract flashcard page data from the TypeScript file and return as list of dictionaries.
    """
    with open(ts_file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Find the array content between the export statement and the closing ];
    start_pattern = r'export const generatedFlashcardPages: ProgrammaticFlashcardPage\[\] = \[([\s\S]*?)\];'
    match = re.search(start_pattern, content, re.DOTALL)
    
    if not match:
        raise ValueError("Could not find array content in the TypeScript file")
    
    array_content = match.group(1)
    
    # Split by object boundaries (}, followed by optional whitespace and comma, then {)
    # This regex finds the pattern between object endings and beginnings
    objects = []
    
    # Find all complete objects using regex
    # Each object starts with { and ends with }, (optionally followed by comma)
    object_pattern = r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}'
    
    # But this is complex due to nested objects. Let's use a different approach.
    # Split by "},\n  {" which separates objects
    raw_objects = array_content.split('},\n  {')
    
    for i, raw_obj in enumerate(raw_objects):
        # Clean up the object string
        obj_str = raw_obj.strip()
        
        # Handle first and last objects specially
        if i == 0:
            # First object starts with just {
            obj_str = obj_str
        else:
            # Middle objects need the { added back
            obj_str = '{' + obj_str
        
        if i == len(raw_objects) - 1:
            # Last object ends with just }
            obj_str = obj_str
        else:
            # Middle objects need }, added back
            obj_str = obj_str + '}'
        
        # Remove any trailing commas before the closing brace
        obj_str = re.sub(r',\s*\}', '}', obj_str)
        
        try:
            obj = json.loads(obj_str)
            objects.append(obj)
        except json.JSONDecodeError as e:
            print(f"Error parsing object {i}: {e}")
            print(f"Object content preview: {obj_str[:300]}...")
            continue
    
    return objects

def generate_csv(ts_file_path, output_csv_path):
    """
    Generate CSV from flashcard pages data.
    """
    pages = extract_flashcard_data(ts_file_path)
    
    print(f"Found {len(pages)} pages to process")
    
    # Prepare CSV data
    csv_data = []
    for page in pages:
        row = {
            'slug': page.get('slug', ''),
            'title': page.get('metadata', {}).get('title', ''),
            'H1': page.get('hero', {}).get('heading', ''),
            'seo_heading': page.get('seoSection', {}).get('heading', '')
        }
        csv_data.append(row)
    
    # Write to CSV
    fieldnames = ['slug', 'title', 'H1', 'seo_heading']
    with open(output_csv_path, 'w', newline='', encoding='utf-8') as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(csv_data)
    
    print(f"CSV generated successfully with {len(csv_data)} rows: {output_csv_path}")

if __name__ == "__main__":
    # File paths - corrected to work from project root
    script_dir = os.path.dirname(os.path.abspath(__file__))
    ts_file_path = os.path.join(script_dir, 'lib', 'programmatic', 'generated', 'flashcardPages.ts')
    output_csv_path = os.path.join(script_dir, 'flashcard_pages_extracted.csv')
    
    # Ensure the TypeScript file exists
    if not os.path.exists(ts_file_path):
        print(f"Error: TypeScript file not found at {ts_file_path}")
        exit(1)
    
    try:
        generate_csv(ts_file_path, output_csv_path)
    except Exception as e:
        print(f"Error processing file: {e}")
        import traceback
        traceback.print_exc()
        exit(1)
