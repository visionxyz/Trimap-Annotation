import os
import shutil

# Define the source and target directories
source_dir = '/Users/xyz/Downloads/Composition-1k-testset'
target_dir = '/Users/xyz/Downloads/Composition-1k-testset-human'
folders_to_extract = ['trimaps', 'merged', 'alpha_copy']

# Create the target directory
os.makedirs(target_dir, exist_ok=True)

# Go through each folder, filter files with '0.png', and copy them to the new structure
for folder in folders_to_extract:
    # Create the corresponding folder in the target directory
    src_folder = os.path.join(source_dir, folder)
    tgt_folder = os.path.join(target_dir, folder)
    os.makedirs(tgt_folder, exist_ok=True)
    
    # List all files in the source folder
    files = os.listdir(src_folder)
    
    # Filter files that end with '_0.png'
    files_to_copy = [file for file in files if file.endswith('_0.png')]
    
    # Copy the filtered files to the target directory
    for file in files_to_copy:
        shutil.copy(os.path.join(src_folder, file), os.path.join(tgt_folder, file))

"File extraction and copying process complete."
