document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const fileList = document.getElementById('file-list');
    const canvas = document.getElementById('image-canvas');
    const ctx = canvas.getContext('2d');
    const loadingElement = document.getElementById('loading');
    const noImageElement = document.getElementById('no-image');
    const createBoxBtn = document.getElementById('create-box-btn');
    const deleteBoxBtn = document.getElementById('delete-box-btn');
    const saveBtn = document.getElementById('save-btn');
    const exportBtn = document.getElementById('export-btn');
    const classSelector = document.getElementById('class-selector');
    const newClassInput = document.getElementById('new-class');
    const addClassBtn = document.getElementById('add-class-btn');
    const renameClassBtn = document.getElementById('rename-class-btn');
    const deleteClassBtn = document.getElementById('delete-class-btn');
    const boxStatsTable = document.getElementById('box-stats');
    const checkSystemBtn = document.getElementById('check-system-btn');
    const setupTrainingBtn = document.getElementById('setup-training-btn'); // New button for setup training
    const backupBtn = document.getElementById('backup-btn'); // Add backup button element
    const uploadArea = document.getElementById('upload-area');
    const classInstructionsText = document.getElementById('class-instructions-text');
    const saveInstructionsBtn = document.getElementById('save-instructions-btn');
    const shortcutKeyElement = document.getElementById('shortcut-key');
    const predictBtn = document.getElementById('predict-btn'); // Add predict button element
    
    // Status filter elements
    const filterDoneBtn = document.getElementById('filter-done');
    const filterInProgressBtn = document.getElementById('filter-in-progress');
    const filterAttentionBtn = document.getElementById('filter-attention');
    
    // State variables
    let currentImage = null;
    let imageObj = new Image();
    let boxes = [];
    let isDrawing = false;
    let startX, startY;
    let selectedBoxIndex = -1;
    let classes = []; // Will be loaded from server
    let classesData = []; // Enhanced class data structure to include instructions
    let isDragging = false;
    let dragStartX, dragStartY;
    let dragMode = null; // 'move', 'resize-nw', 'resize-ne', 'resize-sw', 'resize-se'
    let annotations = {}; // Store annotations for each image
    let zoomLevel = 1;
    let panOffsetX = 0;
    let panOffsetY = 0;
    let isPanning = false;
    let panStartX, panStartY;
    let fileStatuses = {}; // Store file statuses: DONE, IN_PROGRESS, ATTENTION
    let fileBoxCounts = {}; // Store box counts for each file by class
    let originalInstructions = ''; // Track original instructions for comparison
    
    // Status filter state - default to hide DONE files
    let activeFilters = {
        'DONE': false,          // Changed to false to hide by default
        'IN_PROGRESS': true,
        'ATTENTION': true
    };
    
    // Color palette for classes - will be dynamically expanded
    const colorPalette = [
        { stroke: '#00c853', fill: 'rgba(0, 200, 83, 0.2)' },   // Green
        { stroke: '#2196f3', fill: 'rgba(33, 150, 243, 0.2)' }, // Blue
        { stroke: '#ff9800', fill: 'rgba(255, 152, 0, 0.2)' },  // Orange
        { stroke: '#e91e63', fill: 'rgba(233, 30, 99, 0.2)' },  // Pink
        { stroke: '#9c27b0', fill: 'rgba(156, 39, 176, 0.2)' }, // Purple
        { stroke: '#f44336', fill: 'rgba(244, 67, 54, 0.2)' },  // Red
        { stroke: '#ffeb3b', fill: 'rgba(255, 235, 59, 0.2)' }, // Yellow
        { stroke: '#009688', fill: 'rgba(0, 150, 136, 0.2)' },  // Teal
    ];
    
    // Generate colors for new classes beyond the initial palette
    function getClassColor(classIndex) {
        if (classIndex < colorPalette.length) {
            return colorPalette[classIndex];
        } else {
            // Generate a random color if we run out of predefined colors
            const hue = (classIndex * 137) % 360; // Golden ratio to spread colors
            return {
                stroke: `hsl(${hue}, 70%, 50%)`,
                fill: `hsla(${hue}, 70%, 50%, 0.2)`
            };
        }
    }
    
    // Apply transformations to canvas context
    function applyTransformation() {
        ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Apply zoom and pan
        ctx.translate(panOffsetX, panOffsetY);
        ctx.scale(zoomLevel, zoomLevel);
    }
    
    // Convert screen coordinates to image coordinates (accounting for zoom and pan)
    function screenToImageCoords(screenX, screenY) {
        // Account for zoom and pan
        return {
            x: (screenX - panOffsetX) / zoomLevel,
            y: (screenY - panOffsetY) / zoomLevel
        };
    }
    
    // Convert image coordinates to screen coordinates
    function imageToScreenCoords(imageX, imageY) {
        return {
            x: imageX * zoomLevel + panOffsetX,
            y: imageY * zoomLevel + panOffsetY
        };
    }
    
    // Fetch classes with their instructions from the server
    async function loadClasses() {
        try {
            console.log('Fetching classes from API...');
            const response = await fetch('/classes');
            
            if (response.ok) {
                const data = await response.json();
                console.log('Classes loaded:', data);
                
                // Check if we received valid data
                if (!data || !Array.isArray(data)) {
                    console.error('Invalid class data received:', data);
                    alert('Error: Received invalid class data from server');
                    return false;
                }
                
                classesData = data;
                
                // Convert classesData to simple class names for backward compatibility
                classes = classesData.map(c => typeof c === 'object' ? c.name : c);
                
                // Ensure classesData is in the correct format
                classesData = classesData.map((c, index) => {
                    if (typeof c === 'string') {
                        return { name: c, instructions: '', index };
                    } else if (typeof c === 'object') {
                        return { ...c, index, name: c.name || c.class_name || `Class ${index}`, 
                                instructions: c.instructions || '' };
                    }
                    return { name: `Class ${index}`, instructions: '', index };
                });
                
                console.log('Processed class data:', classesData);
                
                // Update the class selector
                updateClassSelector();
                
                // Update displayed instructions for the selected class
                updateClassInstructions();
                
                return true;
            } else {
                console.error('Error loading classes - server returned:', response.status, response.statusText);
                
                // Try to get more error details
                try {
                    const errorData = await response.json();
                    console.error('Server error details:', errorData);
                } catch (e) {
                    console.error('Could not parse error response');
                }
                
                // Create default classes if none exist
                if (confirm('Could not load classes from server. Would you like to create default classes?')) {
                    classesData = [
                        { name: 'Person', instructions: 'Label the entire person from head to toe', index: 0 },
                        { name: 'Car', instructions: 'Label the entire vehicle', index: 1 },
                        { name: 'Animal', instructions: 'Label any animal completely', index: 2 }
                    ];
                    classes = classesData.map(c => c.name);
                    
                    updateClassSelector();
                    updateClassInstructions();
                    
                    return true;
                }
                
                return false;
            }
        } catch (error) {
            console.error('Error loading classes:', error);
            
            // Create default classes if none exist
            if (confirm('Could not load classes from server. Would you like to create default classes?')) {
                classesData = [
                    { name: 'Person', instructions: 'Label the entire person from head to toe', index: 0 },
                    { name: 'Car', instructions: 'Label the entire vehicle', index: 1 },
                    { name: 'Animal', instructions: 'Label any animal completely', index: 2 }
                ];
                classes = classesData.map(c => c.name);
                
                updateClassSelector();
                updateClassInstructions();
                
                return true;
            }
            
            return false;
        }
    }
    
    // Update the class shortcuts list
    function updateClassShortcuts() {
        const shortcutsList = document.getElementById('class-shortcuts-list');
        if (!shortcutsList) return;
        
        // Clear existing shortcuts
        shortcutsList.innerHTML = '';
        
        // Add shortcuts for each class (up to 9)
        classesData.slice(0, 9).forEach((classData, index) => {
            const li = document.createElement('li');
            const kbd = document.createElement('kbd');
            kbd.textContent = index + 1;
            
            // Add color dot
            const colorDot = document.createElement('span');
            colorDot.className = 'color-dot';
            colorDot.style.backgroundColor = getClassColor(index).stroke;
            
            li.appendChild(kbd);
            li.appendChild(document.createTextNode(' '));
            li.appendChild(colorDot);
            li.appendChild(document.createTextNode(` ${classData.name}`));
            
            shortcutsList.appendChild(li);
        });
        
        // Add a message if there are more classes than can have shortcuts
        if (classesData.length > 9) {
            const li = document.createElement('li');
            li.textContent = '(Only first 9 classes have shortcuts)';
            li.style.fontStyle = 'italic';
            li.style.color = '#777';
            shortcutsList.appendChild(li);
        }
    }

    // Update the class selector dropdown with current classes
    function updateClassSelector() {
        if (!classSelector) {
            console.error('Class selector element not found!');
            return;
        }
        
        // Save the current selection
        const selectedValue = classSelector.value;
        
        // Clear the dropdown
        classSelector.innerHTML = '';
        
        console.log('Updating class selector with', classesData.length, 'classes');
        
        // Add each class to the dropdown
        classesData.forEach((classData, index) => {
            const option = document.createElement('option');
            option.value = index;
            
            // Add color indicator to dropdown option
            const classColor = getClassColor(index);
            option.textContent = classData.name;
            option.style.backgroundColor = classColor.fill;
            option.style.borderLeft = `4px solid ${classColor.stroke}`;
            
            classSelector.appendChild(option);
        });
        
        // Try to restore previous selection if it exists
        if (selectedValue && selectedValue < classesData.length) {
            classSelector.value = selectedValue;
        }
        
        console.log('Class selector updated with options:', classSelector.options.length);
        
        // Update class shortcuts
        updateClassShortcuts();
    }
    
    // Update the selected class instructions
    function updateClassInstructions() {
        const selectedIndex = parseInt(classSelector.value);
        if (selectedIndex >= 0 && selectedIndex < classesData.length) {
            const classData = classesData[selectedIndex];
            
            // Update shortcut key (1-9, or "-" if beyond range)
            shortcutKeyElement.textContent = selectedIndex < 9 ? (selectedIndex + 1) : '-';
            
            // Update instructions text and store original value
            const instructions = classData.instructions || '';
            classInstructionsText.value = instructions;
            originalInstructions = instructions;
            
            // Hide the save button initially
            saveInstructionsBtn.style.display = 'none';
        } else {
            shortcutKeyElement.textContent = '-';
            classInstructionsText.value = '';
            originalInstructions = '';
            saveInstructionsBtn.style.display = 'none';
        }
    }
    
    // Check if instructions have changed from original
    function checkInstructionsChanged() {
        const currentInstructions = classInstructionsText.value;
        const hasChanged = currentInstructions !== originalInstructions;
        saveInstructionsBtn.style.display = hasChanged ? 'block' : 'none';
    }
    
    // Save class instructions to the server
    async function saveClassInstructions() {
        const selectedIndex = parseInt(classSelector.value);
        if (selectedIndex >= 0 && selectedIndex < classesData.length) {
            const instructions = classInstructionsText.value;
            
            try {
                const response = await fetch(`/class_instructions/${selectedIndex}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ instructions }),
                });
                
                if (response.ok) {
                    // Update local data
                    classesData[selectedIndex].instructions = instructions;
                    originalInstructions = instructions; // Update original to match current
                    console.log(`Instructions saved for class: ${classesData[selectedIndex].name}`);
                    alert(`Instructions saved for "${classesData[selectedIndex].name}"`);
                    saveInstructionsBtn.style.display = 'none'; // Hide button after saving
                    return true;
                } else {
                    const error = await response.json();
                    console.error('Error saving instructions:', error.detail);
                    alert(`Error saving instructions: ${error.detail}`);
                    return false;
                }
            } catch (error) {
                console.error('Error saving instructions:', error);
                alert(`Error saving instructions: ${error.message}`);
                return false;
            }
        }
    }
    
    // Update loadAllAnnotations function to NOT automatically set statuses
    async function loadAllAnnotations(files) {
        const imageFiles = files.filter(file => file.match(/\.(jpg|jpeg|png|gif|webp|bmp)$/i));
        
        // Fetch file statuses from server
        try {
            const response = await fetch('/file_statuses');
            if (response.ok) {
                fileStatuses = await response.json();
                console.log('File statuses loaded from server:', fileStatuses);
            } else {
                console.error('Error loading file statuses from server:', response.statusText);
                // Load from localStorage as fallback
                const savedStatuses = localStorage.getItem('fileStatuses');
                if (savedStatuses) {
                    fileStatuses = JSON.parse(savedStatuses);
                }
            }
        } catch (error) {
            console.error('Error loading file statuses from server:', error);
            // Load from localStorage as fallback
            const savedStatuses = localStorage.getItem('fileStatuses');
            if (savedStatuses) {
                fileStatuses = JSON.parse(savedStatuses);
            }
        }
        
        // Load box counts for all images
        for (const file of imageFiles) {
            try {
                const response = await fetch(`/annotations/${file}`);
                
                if (response.ok) {
                    const data = await response.json();
                    const boxes = data.boxes || [];
                    
                    // Count boxes by class
                    const counts = {};
                    boxes.forEach(box => {
                        const classIndex = box.class;
                        const className = classes[classIndex] || `Class ${classIndex}`;
                        counts[className] = (counts[className] || 0) + 1;
                    });
                    
                    // Store the counts
                    fileBoxCounts[file] = counts;
                }
            } catch (error) {
                console.error(`Error loading annotations for ${file}:`, error);
            }
        }
        
        // Save updated statuses to localStorage as backup
        localStorage.setItem('fileStatuses', JSON.stringify(fileStatuses));
    }
    
    // New function to update file status on server
    async function updateFileStatus(filename, status) {
        try {
            const response = await fetch(`/file_status/${encodeURIComponent(filename)}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ status }),
            });
            
            if (response.ok) {
                const result = await response.json();
                console.log('Status updated on server:', result.message);
                
                // Update local cache
                fileStatuses[filename] = status;
                localStorage.setItem('fileStatuses', JSON.stringify(fileStatuses));
                
                // Apply filters after status update
                applyFileFilters();
                
                return true;
            } else {
                console.error('Error updating status on server:', response.statusText);
                return false;
            }
        } catch (error) {
            console.error('Error updating status on server:', error);
            return false;
        }
    }
    
    // Create file list item with compact status dropdown
    function createFileListItem(file) {
        const li = document.createElement('li');
        
        // Create inner structure with status, filename, and box counts
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';
        
        // Status dropdown - simplified to single letters
        const statusSelect = document.createElement('select');
        statusSelect.className = 'file-status-select';
        
        // Create options for status dropdown with letter abbreviations
        // But store full status values
        const statusOptions = [
            { letter: 'D', value: 'DONE', title: 'Done' },
            { letter: 'P', value: 'IN_PROGRESS', title: 'In Progress' },
            { letter: 'A', value: 'ATTENTION', title: 'Needs Attention' }
        ];
        
        statusOptions.forEach(option => {
            const optEl = document.createElement('option');
            optEl.value = option.value;
            optEl.textContent = option.letter;
            optEl.title = option.title; // Show full name on hover
            statusSelect.appendChild(optEl);
        });
        
        // Set current status
        const status = fileStatuses[file] || 'IN_PROGRESS';
        statusSelect.value = status;
        
        // Add class for styling based on status
        statusSelect.classList.add(status.toLowerCase().replace('_', '-'));
        
        // Change event remains the same
        statusSelect.addEventListener('change', async (e) => {
            e.stopPropagation(); 
            const newStatus = e.target.value;
            
            // Update dropdown styling
            statusSelect.className = 'file-status-select';
            statusSelect.classList.add(newStatus.toLowerCase().replace('_', '-'));
            
            // Update on server
            await updateFileStatus(file, newStatus);
        });
        
        // Prevent clicking on select from selecting the image
        statusSelect.addEventListener('click', (e) => {
            e.stopPropagation();
        });
        
        // The rest of the function remains the same
        const filenameSpan = document.createElement('span');
        filenameSpan.className = 'filename';
        filenameSpan.textContent = file;
        
        // Box counts
        const countsSpan = document.createElement('span');
        countsSpan.className = 'box-counts';
        
        // Format box counts if we have them
        if (fileBoxCounts[file]) {
            const countText = Object.entries(fileBoxCounts[file])
                .map(([className, count]) => `${className}:${count}`)
                .join(' ');
            countsSpan.textContent = countText;
        } else {
            countsSpan.textContent = 'No boxes';
        }
        
        // Add elements to file item
        fileItem.appendChild(statusSelect);
        fileItem.appendChild(filenameSpan);
        fileItem.appendChild(countsSpan);
        li.appendChild(fileItem);
        
        // Add click handler for image selection
        li.addEventListener('click', () => handleImageSelection(file));
        
        return li;
    }
    
    // Update the updateFileListItem function for the single-letter dropdown
    function updateFileListItem(filename) {
        const items = Array.from(fileList.children);
        
        for (const item of items) {
            const filenameElement = item.querySelector('.filename');
            if (filenameElement && filenameElement.textContent === filename) {
                // Update status dropdown
                const statusSelect = item.querySelector('.file-status-select');
                if (statusSelect) {
                    const status = fileStatuses[filename] || 'IN_PROGRESS';
                    statusSelect.value = status;
                    
                    // Update dropdown styling
                    statusSelect.className = 'file-status-select';
                    statusSelect.classList.add(status.toLowerCase().replace('_', '-'));
                }
                
                // Box counts update unchanged
                const countsElement = item.querySelector('.box-counts');
                if (countsElement && fileBoxCounts[filename]) {
                    const countText = Object.entries(fileBoxCounts[filename])
                        .map(([className, count]) => `${className}:${count}`)
                        .join(' ');
                    countsElement.textContent = countText || 'No boxes';
                }
                
                break;
            }
        }
    }
    
    // Modify loadImageList to apply filters after loading
    async function loadImageList() {
        try {
            // Show loading indicator in file list
            fileList.innerHTML = '<li class="loading-item">Loading images...</li>';
            
            console.log('Fetching image list from API...');
            const response = await fetch('/list_files');
            console.log('API response status:', response.status);
            
            if (response.ok) {
                const files = await response.json();
                console.log('Files received:', files);
                
                // Clear the list
                fileList.innerHTML = '';
                
                // Load all annotations first to get box counts
                await loadAllAnnotations(files);
                
                // Add each file to the list
                let imageCount = 0;
                files.forEach(file => {
                    // Only add image files
                    if (file.match(/\.(jpg|jpeg|png|gif|webp|bmp)$/i)) {
                        const listItem = createFileListItem(file);
                        fileList.appendChild(listItem);
                        imageCount++;
                    }
                });
                
                // Show message if no images found
                if (imageCount === 0) {
                    fileList.innerHTML = '<li class="no-images">No images found. Add some to the images folder.</li>';
                    console.warn('No image files found in the directory.');
                } else {
                    console.log(`Loaded ${imageCount} images.`);
                    
                    // Apply filters after loading files
                    applyFileFilters();
                }
                
                // Show "no image" message if no image is selected
                noImageElement.style.display = 'block';
                loadingElement.style.display = 'none';
            } else {
                console.error('Error loading file list:', response.statusText);
                fileList.innerHTML = `<li class="error-item">Error: ${response.statusText}</li>`;
                // Try again after a delay
                setTimeout(loadImageList, 3000);
            }
        } catch (error) {
            console.error('Error loading file list:', error);
            fileList.innerHTML = `<li class="error-item">Error: ${error.message}</li>
                                  <li class="retry-item" id="retry-btn">Retry</li>`;
            
            // Add retry button
            document.getElementById('retry-btn')?.addEventListener('click', loadImageList);
        }
    }
    
    // Apply filters to the file list
    function applyFileFilters() {
        const items = Array.from(fileList.children);
        
        items.forEach(item => {
            // Skip special items like loading, error, etc.
            if (item.classList.contains('loading-item') || 
                item.classList.contains('error-item') || 
                item.classList.contains('no-images') ||
                item.classList.contains('retry-item')) {
                return;
            }
            
            const statusSelect = item.querySelector('.file-status-select');
            if (statusSelect) {
                const status = statusSelect.value;
                
                // Show or hide based on filter state
                if (activeFilters[status]) {
                    item.style.display = ''; // Show this item
                } else {
                    item.style.display = 'none'; // Hide this item
                }
            }
        });
        
        // Update counter if we want to show how many files are visible
        updateFilteredCount();
    }
    
    // Update counter for filtered files (optional)
    function updateFilteredCount() {
        const totalItems = fileList.querySelectorAll('li:not(.loading-item):not(.error-item):not(.no-images):not(.retry-item)').length;
        const visibleItems = fileList.querySelectorAll('li:not(.loading-item):not(.error-item):not(.no-images):not(.retry-item):not([style*="display: none"])').length;
        
        // Optional: Update some UI element with the count
        console.log(`Showing ${visibleItems} of ${totalItems} files`);
    }
    
    // Toggle filter state for a status
    function toggleFilter(status, button) {
        activeFilters[status] = !activeFilters[status];
        button.classList.toggle('active', activeFilters[status]);
        
        // If all filters are inactive, activate all (show everything)
        if (!Object.values(activeFilters).some(active => active)) {
            Object.keys(activeFilters).forEach(key => {
                activeFilters[key] = true;
            });
            
            // Update button states to match
            filterDoneBtn.classList.add('active');
            filterInProgressBtn.classList.add('active');
            filterAttentionBtn.classList.add('active');
        }
        
        // Apply the new filters
        applyFileFilters();
    }
    
    // Add event listeners for filter buttons
    if (filterDoneBtn) {
        filterDoneBtn.addEventListener('click', () => {
            toggleFilter('DONE', filterDoneBtn);
        });
    }
    
    if (filterInProgressBtn) {
        filterInProgressBtn.addEventListener('click', () => {
            toggleFilter('IN_PROGRESS', filterInProgressBtn);
        });
    }
    
    if (filterAttentionBtn) {
        filterAttentionBtn.addEventListener('click', () => {
            toggleFilter('ATTENTION', filterAttentionBtn);
        });
    }
    
    // Update saveAnnotations to NOT automatically change the status
    async function saveAnnotations(silentMode = false) {
        if (!currentImage) return;
        
        try {
            // Store current boxes in local cache
            annotations[currentImage] = [...boxes];
            
            // Convert to YOLO format for server storage
            const yoloBoxes = boxes.map(box => boxToYolo(box));
            
            // Send to server
            const response = await fetch(`/annotations/${currentImage}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ boxes: yoloBoxes }),
            });
            
            if (response.ok) {
                const result = await response.json();
                console.log('Annotations saved:', result.message);
                
                // Update box counts for this file
                const counts = {};
                boxes.forEach(box => {
                    const classIndex = box.class;
                    const className = classes[classIndex] || `Class ${classIndex}`;
                    counts[className] = (counts[className] || 0) + 1;
                });
                fileBoxCounts[currentImage] = counts;
                
                // Update file list display (with current status, not changing it)
                updateFileListItem(currentImage);
                
                // Skip download and alert if in silent mode (when changing images)
                if (!silentMode) {
                    // Create a local download of the annotation file
                    const yoloText = yoloBoxes.map(box => 
                        `${box.class} ${box.x_center.toFixed(6)} ${box.y_center.toFixed(6)} ${box.width.toFixed(6)} ${box.height.toFixed(6)}`
                    ).join('\n');
                    
                    const filename = currentImage.replace(/\.[^/.]+$/, ".txt");
                    const blob = new Blob([yoloText], { type: 'text/plain' });
                    const url = URL.createObjectURL(blob);
                    
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = filename;
                    a.click();
                    
                    URL.revokeObjectURL(url);
                    
                    alert(`Annotations saved for ${currentImage}`);
                }
                return true;
            } else {
                const error = await response.json();
                console.error('Error saving annotations:', error.detail);
                alert(`Error saving annotations: ${error.detail}`);
                return false;
            }
        } catch (error) {
            console.error('Error saving annotations:', error);
            alert(`Error saving annotations: ${error.message}`);
            return false;
        }
    }
    
    // Handle image selection: save current annotations before loading a new image
    async function handleImageSelection(filename) {
        // If there's a current image with annotations, save them first
        if (currentImage && boxes.length > 0) {
            console.log(`Saving annotations for ${currentImage} before switching to ${filename}`);
            try {
                await saveAnnotations(true); // Pass true to skip the download and alert
            } catch (error) {
                console.error('Error saving annotations before switching images:', error);
                // Ask user if they want to proceed anyway
                if (!confirm(`Failed to save annotations for current image. Switch to ${filename} anyway? (Unsaved changes will be lost)`)) {
                    return; // Don't switch images if user cancels
                }
            }
        }
        
        // Now load the new image
        loadImage(filename);
    }
    
    // Load selected image and its annotations
    async function loadImage(filename) {
        console.log(`Loading image: ${filename}`);
        
        // Update selected item styling - fix selection logic to use filename element
        Array.from(fileList.children).forEach(li => {
            li.classList.remove('active');
            const filenameEl = li.querySelector('.filename');
            if (filenameEl && filenameEl.textContent === filename) {
                li.classList.add('active');
            }
        });
        
        // Show loading indicator
        loadingElement.style.display = 'block';
        loadingElement.textContent = 'Loading image...';
        noImageElement.style.display = 'none';
        
        // Clear the canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Reset selection when changing images
        selectedBoxIndex = -1;
        
        // Reset zoom and pan when loading a new image
        zoomLevel = 1;
        panOffsetX = 0;
        panOffsetY = 0;
        
        // Load the new image
        currentImage = filename;
        
        // Create a new Image object each time to avoid caching issues
        imageObj = new Image();
        
        // Setup event handlers before setting the src
        imageObj.onload = async function() {
            console.log(`Image loaded: ${filename} (${imageObj.width}x${imageObj.height})`);
            
            // Set canvas size to match image
            canvas.width = imageObj.width;
            canvas.height = imageObj.height;
            
            // Draw the image
            ctx.drawImage(imageObj, 0, 0);
            
            // After image is loaded, load its annotations from server
            try {
                const response = await fetch(`/annotations/${filename}`);
                
                if (response.ok) {
                    const data = await response.json();
                    const yoloBoxes = data.boxes || [];
                    
                    // Convert normalized YOLO coordinates to pixel coordinates
                    boxes = yoloBoxes.map(box => ({
                        class: box.class,
                        x: Math.round((box.x_center - box.width / 2) * canvas.width),
                        y: Math.round((box.y_center - box.height / 2) * canvas.height),
                        width: Math.round(box.width * canvas.width),
                        height: Math.round(box.height * canvas.height)
                    }));
                    
                    // Store in annotations cache
                    annotations[currentImage] = [...boxes];
                } else {
                    console.error('Error loading annotations:', response.statusText);
                    boxes = [];
                    annotations[currentImage] = [];
                }
            } catch (error) {
                console.error('Error loading annotations:', error);
                boxes = [];
                annotations[currentImage] = [];
            }
            
            // Draw the boxes
            drawBoxes();
            
            // Hide loading indicator
            loadingElement.style.display = 'none';
            updateBoxStats();
        };
        
        imageObj.onerror = function(event) {
            console.error('Error loading image:', event);
            loadingElement.textContent = `Error loading image: ${filename}`;
            loadingElement.style.display = 'block';
            alert(`Failed to load image: ${filename}. Please check if the file exists and is accessible.`);
        };
        
        // Add a timestamp to prevent caching issues
        const timestamp = new Date().getTime();
        imageObj.src = `/get_file?filename=${encodeURIComponent(filename)}&t=${timestamp}`;
        console.log(`Requested image URL: ${imageObj.src}`);
    }
    
    // Draw all bounding boxes
    function drawBoxes() {
        // Clear canvas and apply transformation
        applyTransformation();
        
        // Draw the image
        ctx.drawImage(imageObj, 0, 0);
        
        // Draw each box
        boxes.forEach((box, index) => {
            const isSelected = index === selectedBoxIndex;
            let classColor = getClassColor(box.class);
            
            // Use different style for predicted boxes
            if (box.isPredicted) {
                // Use a different color style for predicted boxes
                classColor = {
                    stroke: `hsl(${(box.class * 137) % 360}, 100%, 40%)`,
                    fill: `hsla(${(box.class * 137) % 360}, 100%, 50%, 0.3)`
                };
            }
            
            // Draw rectangle
            ctx.strokeStyle = isSelected ? '#ff0000' : classColor.stroke;
            ctx.lineWidth = isSelected ? 3 : 2;
            ctx.strokeRect(box.x, box.y, box.width, box.height);
            
            // Fill with semi-transparent color
            ctx.fillStyle = isSelected ? 'rgba(255, 0, 0, 0.2)' : classColor.fill;
            ctx.fillRect(box.x, box.y, box.width, box.height);
            
            // Draw label - add null check for class name
            ctx.fillStyle = isSelected ? '#ff0000' : classColor.stroke;
            ctx.font = isSelected ? 'bold 14px Arial' : '12px Arial';
            
            // Add a background to the label for better readability
            let label = classes[box.class] || `Unknown Class (${box.class})`;
            
            // Add confidence if available for predicted boxes
            if (box.isPredicted && box.confidence !== null) {
                label += ` (${Math.round(box.confidence * 100)}%)`;
            }
            
            const labelWidth = ctx.measureText(label).width + 4;
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.fillRect(box.x, box.y - 20, labelWidth, 20);
            
            // Draw the text
            ctx.fillStyle = 'white';
            ctx.fillText(label, box.x + 2, box.y - 5);
            
            // Draw resize handles if selected
            if (isSelected) {
                drawHandle(box.x, box.y); // NW
                drawHandle(box.x + box.width, box.y); // NE
                drawHandle(box.x, box.y + box.height); // SW
                drawHandle(box.x + box.width, box.y + box.height); // SE
            }
            
            // Add "AI" indicator for predicted boxes
            if (box.isPredicted) {
                ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
                ctx.fillRect(box.x + box.width - 20, box.y - 20, 20, 20);
                ctx.fillStyle = 'white';
                ctx.font = '10px Arial';
                ctx.fillText('AI', box.x + box.width - 16, box.y - 6);
            }
        });
    }
    
    // Draw a resize handle
    function drawHandle(x, y) {
        const handleSize = 6;
        ctx.fillStyle = 'white';
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 1;
        ctx.fillRect(x - handleSize/2, y - handleSize/2, handleSize, handleSize);
        ctx.strokeRect(x - handleSize/2, y - handleSize/2, handleSize, handleSize);
    }
    
    // Check if a point is near a handle
    function getNearestHandle(x, y) {
        if (selectedBoxIndex === -1) return null;
        
        const box = boxes[selectedBoxIndex];
        // Add null check to prevent errors
        if (!box) {
            console.warn(`Box at index ${selectedBoxIndex} is undefined`);
            selectedBoxIndex = -1; // Reset selection if box doesn't exist
            return null;
        }
        
        const handleSize = 8; // Detection area
        
        // Check each handle
        if (Math.abs(x - box.x) < handleSize && Math.abs(y - box.y) < handleSize) {
            return 'resize-nw';
        }
        if (Math.abs(x - (box.x + box.width)) < handleSize && Math.abs(y - box.y) < handleSize) {
            return 'resize-ne';
        }
        if (Math.abs(x - box.x) < handleSize && Math.abs(y - (box.y + box.height)) < handleSize) {
            return 'resize-sw';
        }
        if (Math.abs(x - (box.x + box.width)) < handleSize && Math.abs(y - (box.y + box.height)) < handleSize) {
            return 'resize-se';
        }
        
        // Check if inside the box
        if (x > box.x && x < box.x + box.width && y > box.y && y < box.y + box.height) {
            return 'move';
        }
        
        return null;
    }
    
    // Update box statistics in the UI
    function updateBoxStats() {
        // Clear table
        while (boxStatsTable.rows.length > 1) {
            boxStatsTable.deleteRow(1);
        }
        
        // Add row for each box
        boxes.forEach((box, index) => {
            const row = boxStatsTable.insertRow();
            row.classList.toggle('selected', index === selectedBoxIndex);
            
            // Add predicted class indicator
            if (box.isPredicted) {
                row.classList.add('predicted-box');
            }
            
            // Get class color for this row
            const classColor = getClassColor(box.class);
            
            // Create class cell with dropdown
            const classCell = row.insertCell();
            const classDropdown = document.createElement('select');
            classDropdown.className = 'box-class-dropdown';
            // Make dropdown half the size
            classDropdown.style.width = '80px'; // Set a fixed width that's approximately half the default size
            classDropdown.style.maxWidth = '80px';
            classDropdown.style.overflow = 'hidden';
            classDropdown.style.textOverflow = 'ellipsis';
            
            // Populate the dropdown with all available classes
            classesData.forEach((classData, classIndex) => {
                const option = document.createElement('option');
                option.value = classIndex;
                option.textContent = classData.name;
                option.selected = classIndex === box.class;
                classDropdown.appendChild(option);
            });
            
            // Add color indicator to the class cell
            const colorDot = document.createElement('span');
            colorDot.className = 'color-dot';
            colorDot.style.backgroundColor = classColor.stroke;
            classCell.appendChild(colorDot);
            classCell.appendChild(classDropdown);
            
            // Add AI indicator for predicted boxes
            if (box.isPredicted) {
                const aiIndicator = document.createElement('span');
                aiIndicator.className = 'ai-indicator';
                aiIndicator.title = 'AI Predicted';
                aiIndicator.textContent = '🤖';
                aiIndicator.style.marginLeft = '2px';
                classCell.appendChild(aiIndicator);
            }
            
            // Prevent dropdown click from triggering row selection
            classDropdown.addEventListener('click', (e) => {
                e.stopPropagation();
            });
            
            // Prevent dropdown focus from triggering row selection
            classDropdown.addEventListener('focus', (e) => {
                e.stopPropagation();
            });
            
            // Add event listener to update box class when dropdown changes
            classDropdown.addEventListener('change', (e) => {
                e.stopPropagation(); 
                const newClassIndex = parseInt(e.target.value);
                box.class = newClassIndex;
                box.isPredicted = false; // No longer a prediction once modified
                drawBoxes();
                
                // Just update the color dot instead
                colorDot.style.backgroundColor = getClassColor(newClassIndex).stroke;
                
                // Remove the predicted-box class from the row
                row.classList.remove('predicted-box');
                
                // Remove AI indicator if it exists
                const aiIndicator = classCell.querySelector('.ai-indicator');
                if (aiIndicator) {
                    classCell.removeChild(aiIndicator);
                }
            });
            
            // Add remaining cells (coordinates and dimensions)
            row.insertCell().textContent = Math.round(box.x);
            row.insertCell().textContent = Math.round(box.y);
            row.insertCell().textContent = Math.round(box.width);
            row.insertCell().textContent = Math.round(box.height);
            
            // Add delete button cell
            const actionCell = row.insertCell();
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'box-delete-btn';
            deleteBtn.innerHTML = '&times;';
            deleteBtn.title = 'Delete box';
            
            // Add event listener to delete box
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent row selection when deleting
                boxes.splice(index, 1);
                
                // Update selected box index if needed
                if (selectedBoxIndex === index) {
                    selectedBoxIndex = -1;
                } else if (selectedBoxIndex > index) {
                    selectedBoxIndex--;
                }
                
                drawBoxes();
                updateBoxStats();
            });
            
            actionCell.appendChild(deleteBtn);
            
            // Add click event to select box
            row.addEventListener('click', () => {
                selectedBoxIndex = index;
                drawBoxes();
                updateBoxStats();
            });
        });
    }
    
    // Convert box coordinates to YOLO format (normalized)
    function boxToYolo(box) {
        const x_center = (box.x + box.width / 2) / canvas.width;
        const y_center = (box.y + box.height / 2) / canvas.height;
        const width = box.width / canvas.width;
        const height = box.height / canvas.height;
        
        return {
            class: box.class,
            x_center,
            y_center,
            width,
            height
        };
    }
    
    // Export the complete dataset as a zip file
    async function exportDataset() {
        try {
            // First save the current annotations if any
            if (currentImage && boxes.length > 0) {
                await saveAnnotations();
            }
            
            // Show loading message
            alert('Preparing dataset for export. This may take a moment...');
            
            // Request the zip file from the server
            window.location.href = '/export_dataset';
            
            return true;
        } catch (error) {
            console.error('Error exporting dataset:', error);
            alert(`Error exporting dataset: ${error.message}`);
            return false;
        }
    }
    
    // Check system configuration and show diagnostic information
    async function checkSystem() {
        try {
            console.log('Checking system configuration...');
            const response = await fetch('/system_info');
            
            if (response.ok) {
                const info = await response.json();
                console.log('System info:', info);
                
                let message = `
System Information:
------------------
Current Working Directory: ${info.cwd}
Images Folder: ${info.abs_images_folder}
Images Folder Exists: ${info.images_folder_exists}
Image Count: ${info.image_count}

First few images:
${info.image_files.join('\n')}

Annotations Folder: ${info.annotations_folder}
Annotations Folder Exists: ${info.annotations_folder_exists}
                `;
                
                alert(message);
                return true;
            } else {
                console.error('Error checking system:', response.statusText);
                alert(`Error checking system: ${response.statusText}`);
                return false;
            }
        } catch (error) {
            console.error('Error checking system:', error);
            alert(`Error checking system: ${error.message}`);
            return false;
        }
    }
    
    // Setup training data for YOLO
    async function setupTraining() {
        try {
            console.log('Setting up YOLO training environment...');
            loadingElement.style.display = 'block';
            loadingElement.textContent = 'Setting up training environment...';
            
            const response = await fetch('/setup_training');
            
            if (response.ok) {
                const result = await response.json();
                console.log('Training setup complete:', result);
                
                if (result.success) {
                    let message = `
Training Setup Complete ✅
------------------------
📁 Training directory: ${result.training_dir}
🖼️ Images copied: ${result.images_copied}
🏷️ Labels copied: ${result.labels_copied}

Classes:
${result.classes.map((cls, i) => `  ${i}: ${cls}`).join('\n')}

The training environment is now ready for YOLOv8.
You can train a model using the command:
yolo train model=yolov8n.pt data=${result.training_dir}/dataset.yaml epochs=50
                    `;
                    
                    alert(message);
                } else {
                    alert(`Setup failed: ${result.error || 'Unknown error'}`);
                }
                
                return result.success;
            } else {
                const error = await response.json();
                console.error('Setup training error:', error);
                alert(`Error setting up training: ${error.detail || 'Unknown error'}`);
                return false;
            }
        } catch (error) {
            console.error('Error setting up training:', error);
            alert(`Error setting up training: ${error.message}`);
            return false;
        } finally {
            loadingElement.style.display = 'none';
        }
    }
    
    // Create backup of all data
    async function backupData() {
        try {
            // First save the current annotations if any
            if (currentImage && boxes.length > 0) {
                await saveAnnotations(true); // Silent mode to avoid download prompt
            }
            
            console.log('Creating backup...');
            alert('Preparing backup for download. This may take a moment...');
            
            // Trigger download from the backup endpoint
            window.location.href = '/backup';
            
            return true;
        } catch (error) {
            console.error('Error creating backup:', error);
            alert(`Error creating backup: ${error.message}`);
            return false;
        }
    }
    
    // Get accurate canvas coordinates from mouse event
    function getCanvasCoordinates(e) {
        const rect = canvas.getBoundingClientRect();
        
        // Calculate the scaling factor between displayed size and actual canvas dimensions
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        
        // Calculate scroll offset if the canvas container is scrollable
        const scrollLeft = document.documentElement.scrollLeft || document.body.scrollLeft;
        const scrollTop = document.documentElement.scrollTop || document.body.scrollTop;
        
        // Apply scaling to get accurate canvas coordinates
        const x = (e.clientX - rect.left + scrollLeft) * scaleX;
        const y = (e.clientY - rect.top + scrollTop) * scaleY;
        
        // Convert to image coordinates (accounting for zoom and pan)
        return screenToImageCoords(x, y);
    }
    
    // File Upload Functionality
    function setupFileUpload() {
        if (!uploadArea) return;
        
        // Prevent default behavior for drag events
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            uploadArea.addEventListener(eventName, preventDefaults, false);
            document.body.addEventListener(eventName, preventDefaults, false);
        });
        
        // Add visual feedback for drag events
        ['dragenter', 'dragover'].forEach(eventName => {
            uploadArea.addEventListener(eventName, highlight, false);
        });
        
        ['dragleave', 'drop'].forEach(eventName => {
            uploadArea.addEventListener(eventName, unhighlight, false);
        });
        
        // Handle dropped files
        uploadArea.addEventListener('drop', handleDrop, false);
        
        // Also handle click to select files
        uploadArea.addEventListener('click', () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.multiple = true;
            input.accept = 'image/*';
            input.onchange = (e) => {
                handleFiles(e.target.files);
            };
            input.click();
        });
    }
    
    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    function highlight() {
        uploadArea.classList.add('dragover');
    }
    
    function unhighlight() {
        uploadArea.classList.remove('dragover');
    }
    
    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        handleFiles(files);
    }
    
    function handleFiles(files) {
        if (files.length === 0) return;
        
        // Show upload progress
        const progressBar = document.createElement('div');
        progressBar.className = 'upload-progress';
        uploadArea.appendChild(progressBar);
        
        // Convert FileList to array for easier handling
        let fileArray = Array.from(files);
        
        // Filter for image files only
        fileArray = fileArray.filter(file => 
            file.type.match(/^image\/(jpeg|png|gif|bmp|webp)$/i)
        );
        
        if (fileArray.length === 0) {
            alert('No valid image files selected. Please upload jpg, jpeg, png, gif, webp, or bmp files.');
            uploadArea.removeChild(progressBar);
            return;
        }
        
        // Show upload count
        const originalText = uploadArea.innerHTML;
        uploadArea.innerHTML = `<div class="upload-icon">⏳</div>
                              <p>Uploading ${fileArray.length} files...</p>`;
        uploadArea.appendChild(progressBar);
        
        // Create FormData to send files
        const formData = new FormData();
        fileArray.forEach(file => {
            formData.append('files', file);
        });
        
        // Upload the files
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/upload_files', true);
        
        // Update progress bar
        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
                const percentComplete = (e.loaded / e.total) * 100;
                progressBar.style.width = percentComplete + '%';
            }
        });
        
        // Handle completion
        xhr.onload = function() {
            if (xhr.status === 200) {
                // Parse response
                let response;
                try {
                    response = JSON.parse(xhr.responseText);
                    console.log('Upload successful:', response);
                    
                    // Show success message
                    uploadArea.innerHTML = `<div class="upload-icon">✅</div>
                                          <p>Uploaded ${response.uploaded_count} files</p>`;
                    
                    // Reset after a delay
                    setTimeout(() => {
                        uploadArea.innerHTML = originalText;
                        // Refresh the file list
                        loadImageList();
                    }, 3000);
                } catch (e) {
                    console.error('Failed to parse upload response:', e);
                    uploadArea.innerHTML = originalText;
                    alert('Error uploading files: Unable to parse server response');
                }
            } else {
                console.error('Upload failed:', xhr.status, xhr.statusText);
                uploadArea.innerHTML = originalText;
                alert(`Error uploading files: ${xhr.status} ${xhr.statusText}`);
            }
        };
        
        // Handle errors
        xhr.onerror = function() {
            console.error('Upload failed due to network error');
            uploadArea.innerHTML = originalText;
            alert('Error uploading files: Network error');
        };
        
        // Send the files
        xhr.send(formData);
    }
    
    // Event Listeners
    canvas.addEventListener('mousedown', (e) => {
        // Middle mouse button (button 1)
        if (e.button === 1) {
            e.preventDefault();
            isPanning = true;
            panStartX = e.clientX;
            panStartY = e.clientY;
            canvas.style.cursor = 'grabbing';
            return;
        }
        
        const coords = getCanvasCoordinates(e);
        const x = coords.x;
        const y = coords.y;
        
        // Check if we're clicking on a box or handle
        const handle = getNearestHandle(x, y);
        
        if (handle) {
            // Start dragging or resizing
            isDragging = true;
            dragStartX = x;
            dragStartY = y;
            dragMode = handle;
        } else {
            // Check if clicking on a box
            let clickedBoxIndex = -1;
            
            for (let i = boxes.length - 1; i >= 0; i--) {
                const box = boxes[i];
                if (x >= box.x && x <= box.x + box.width &&
                    y >= box.y && y <= box.y + box.height) {
                    clickedBoxIndex = i;
                    break;
                }
            }
            
            if (clickedBoxIndex !== -1) {
                // Select this box
                selectedBoxIndex = clickedBoxIndex;
                drawBoxes();
                updateBoxStats();
            } else if (isDrawing) {
                // Start drawing a new box
                startX = x;
                startY = y;
            }
        }
    });
    
    canvas.addEventListener('mousemove', (e) => {
        // Handle panning
        if (isPanning) {
            const dx = e.clientX - panStartX;
            const dy = e.clientY - panStartY;
            
            panOffsetX += dx;
            panOffsetY += dy;
            
            panStartX = e.clientX;
            panStartY = e.clientY;
            
            drawBoxes();
            return;
        }
        
        const coords = getCanvasCoordinates(e);
        const x = coords.x;
        const y = coords.y;
        
        // Change cursor based on position
        if (!isDragging) {
            const handle = getNearestHandle(x, y);
            if (handle === 'resize-nw' || handle === 'resize-se') {
                canvas.style.cursor = 'nwse-resize';
            } else if (handle === 'resize-ne' || handle === 'resize-sw') {
                canvas.style.cursor = 'nesw-resize';
            } else if (handle === 'move') {
                canvas.style.cursor = 'move';
            } else {
                canvas.style.cursor = isDrawing ? 'crosshair' : 'default';
            }
        }
        
        if (isDragging && selectedBoxIndex !== -1) {
            const box = boxes[selectedBoxIndex];
            const dx = x - dragStartX;
            const dy = y - dragStartY;
            
            // Handle different drag modes
            if (dragMode === 'move') {
                box.x += dx;
                box.y += dy;
            } else if (dragMode === 'resize-nw') {
                box.width -= dx;
                box.height -= dy;
                box.x += dx;
                box.y += dy;
            } else if (dragMode === 'resize-ne') {
                box.width += dx;
                box.height -= dy;
                box.y += dy;
            } else if (dragMode === 'resize-sw') {
                box.width -= dx;
                box.height += dy;
                box.x += dx;
            } else if (dragMode === 'resize-se') {
                box.width += dx;
                box.height += dy;
            }
            
            // Ensure positive width and height
            if (box.width < 1) box.width = 1;
            if (box.height < 1) box.height = 1;
            
            // Keep box within canvas bounds
            box.x = Math.max(0, Math.min(box.x, canvas.width - box.width));
            box.y = Math.max(0, Math.min(box.y, canvas.height - box.height));
            
            dragStartX = x;
            dragStartY = y;
            
            drawBoxes();
            updateBoxStats();
        } else if (isDrawing) {
            // Draw box preview
            if (startX !== undefined && startY !== undefined) {
                drawBoxes(); // Redraw existing boxes
                
                // Draw preview box
                const width = x - startX;
                const height = y - startY;
                
                // Use the color for the current class
                const classIndex = parseInt(classSelector.value);
                const classColor = getClassColor(classIndex);
                
                // Draw dashed outline for the preview
                ctx.strokeStyle = classColor.stroke;
                ctx.lineWidth = 2;
                ctx.setLineDash([5, 5]);
                ctx.strokeRect(startX, startY, width, height);
                
                // Fill with very transparent color
                ctx.fillStyle = classColor.fill.replace('0.2', '0.1');
                ctx.fillRect(startX, startY, width, height);
                ctx.setLineDash([]);
                
                // Show dimensions
                const absWidth = Math.abs(width);
                const absHeight = Math.abs(height);
                const dimensionText = `${absWidth.toFixed(0)} × ${absHeight.toFixed(0)}`;
                
                // Position for dimension text
                const textX = startX + width / 2;
                const textY = startY + height / 2;
                
                // Draw dimension text with outline
                ctx.font = '14px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                
                const textMeasure = ctx.measureText(dimensionText);
                const textPadding = 5;
                ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
                ctx.fillRect(
                    textX - textMeasure.width/2 - textPadding,
                    textY - 10 - textPadding,
                    textMeasure.width + textPadding*2,
                    20 + textPadding*2
                );
                
                ctx.fillStyle = 'white';
                ctx.fillText(dimensionText, textX, textY);
                
                ctx.textAlign = 'start';
                ctx.textBaseline = 'alphabetic';
            }
        }
    });
    
    canvas.addEventListener('mouseup', (e) => {
        // End panning
        if (e.button === 1) {
            isPanning = false;
            canvas.style.cursor = isDrawing ? 'crosshair' : 'default';
            return;
        }
        
        const coords = getCanvasCoordinates(e);
        const x = coords.x;
        const y = coords.y;
        
        if (isDragging) {
            isDragging = false;
            dragMode = null;
        } else if (isDrawing && startX !== undefined && startY !== undefined) {
            // Create a new box
            let width = x - startX;
            let height = y - startY;
            
            // Handle negative dimensions
            let newX = startX;
            let newY = startY;
            
            if (width < 0) {
                newX = x;
                width = Math.abs(width);
            }
            
            if (height < 0) {
                newY = y;
                height = Math.abs(height);
            }
            
            // Add the box if it has a meaningful size
            if (width > 5 && height > 5) {
                const newBox = {
                    x: newX,
                    y: newY,
                    width,
                    height,
                    class: parseInt(classSelector.value)
                };
                
                boxes.push(newBox);
                selectedBoxIndex = boxes.length - 1;
                drawBoxes();
                updateBoxStats();
            }
        }
        
        // Reset drawing state
        startX = undefined;
        startY = undefined;
    });
    
    // Ensure we end panning even if mouse leaves canvas
    canvas.addEventListener('mouseleave', () => {
        if (isPanning) {
            isPanning = false;
            canvas.style.cursor = isDrawing ? 'crosshair' : 'default';
        }
    });
    
    // Prevent context menu on right-click 
    canvas.addEventListener('contextmenu', (e) => {
        e.preventDefault();
    });
    
    // Handle zoom functionality
    canvas.addEventListener('wheel', (e) => {
        e.preventDefault(); // Prevent page scrolling
        
        if (!currentImage) return; // Don't zoom if no image is loaded
        
        // Get mouse position relative to canvas
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        // Calculate scaling factor
        const scaleFactor = e.deltaY < 0 ? 1.1 : 0.9;
        
        // Get mouse position in image coordinates before zoom
        const beforeZoomX = (mouseX - panOffsetX) / zoomLevel;
        const beforeZoomY = (mouseY - panOffsetY) / zoomLevel;
        
        // Apply zoom
        zoomLevel *= scaleFactor;
        
        // Limit zoom level
        zoomLevel = Math.min(Math.max(0.1, zoomLevel), 10);
        
        // Get mouse position in image coordinates after zoom
        const afterZoomX = (mouseX - panOffsetX) / zoomLevel;
        const afterZoomY = (mouseY - panOffsetY) / zoomLevel;
        
        // Adjust pan offset to zoom at mouse position
        panOffsetX += (afterZoomX - beforeZoomX) * zoomLevel;
        panOffsetY += (afterZoomY - beforeZoomY) * zoomLevel;
        
        // Redraw with new transformation
        drawBoxes();
    });
    
    // Add keyboard shortcuts for class selection (1-9 keys)
    document.addEventListener('keydown', (e) => {
        // Skip shortcut processing if currently typing in class instructions textarea
        if (document.activeElement === classInstructionsText) {
            return;
        }
        
        // Only handle number keys 1-9
        if (e.key >= '1' && e.key <= '9') {
            const classIndex = parseInt(e.key) - 1; // Convert to 0-based index
            
            // Check if this class exists
            if (classIndex < classes.length) {
                // Select the class in the dropdown
                classSelector.value = classIndex;
                
                // Update the instructions to match the newly selected class
                updateClassInstructions();
                
                // Update the selected box's class if one is selected
                if (selectedBoxIndex !== -1) {
                    boxes[selectedBoxIndex].class = classIndex;
                    drawBoxes();
                    updateBoxStats();
                }
                
                // Show feedback
                console.log(`Changed to class: ${classes[classIndex]}`);
            }
        }
    });
    
    // Create Box button click
    createBoxBtn.addEventListener('click', () => {
        isDrawing = !isDrawing;
        createBoxBtn.textContent = isDrawing ? 'Cancel Box' : 'Create Box';
        createBoxBtn.classList.toggle('active', isDrawing);
        canvas.style.cursor = isDrawing ? 'crosshair' : 'default';
    });
    
    // Delete Box button click
    deleteBoxBtn.addEventListener('click', () => {
        if (selectedBoxIndex !== -1) {
            boxes.splice(selectedBoxIndex, 1);
            selectedBoxIndex = -1;
            drawBoxes();
            updateBoxStats();
        }
    });
    
    // Save button click
    if (saveBtn) {
        saveBtn.addEventListener('click', saveAnnotations);
    }

    // Export button click
    if (exportBtn) {
        exportBtn.addEventListener('click', exportDataset);
    } else {
        console.error("Export button not found in the DOM. Check that the HTML includes <button id='export-btn'>Export YOLO Dataset</button>");
    }

    // Check System button click
    if (checkSystemBtn) {
        checkSystemBtn.addEventListener('click', checkSystem);
    }
    
    // Backup button click
    if (backupBtn) {
        backupBtn.addEventListener('click', backupData);
    }
    
    // Setup Training button click
    if (setupTrainingBtn) {
        setupTrainingBtn.addEventListener('click', setupTraining);
    }
    
    // Add Class button click
    addClassBtn.addEventListener('click', () => {
        const className = prompt('Enter new class name:');
        if (className && className.trim() !== '') {
            addClass(className.trim()).then(success => {
                if (success) {
                    // Select the newly added class
                    classSelector.value = classes.length - 1;
                    // Update class shortcuts
                    updateClassShortcuts();
                }
            });
        }
    });
    
    // Rename Class button click
    renameClassBtn.addEventListener('click', () => {
        const classIndex = parseInt(classSelector.value);
        const newName = prompt('Enter new name for class:', classes[classIndex]);
        
        if (newName && newName.trim() !== '') {
            renameClass(classIndex, newName.trim()).then(() => {
                // Update class shortcuts after renaming
                updateClassShortcuts();
            });
        }
    });
    
    // Delete Class button click
    deleteClassBtn.addEventListener('click', () => {
        const classIndex = parseInt(classSelector.value);
        if (confirm(`Are you sure you want to delete the class "${classes[classIndex]}"?`)) {
            deleteClass(classIndex).then(() => {
                // Update class shortcuts after deletion
                updateClassShortcuts();
            });
        }
    });
    
    // Add event listeners for the class instructions
    saveInstructionsBtn.addEventListener('click', saveClassInstructions);
    
    // Add listener to detect changes in the instructions text
    classInstructionsText.addEventListener('input', checkInstructionsChanged);
    
    // Update instructions when class selection changes
    classSelector.addEventListener('change', updateClassInstructions);
    
    // Add missing class management functions
    
    // Function to add a new class to the server
    async function addClass(className) {
        try {
            const response = await fetch('/classes', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ class_name: className }),
            });
            
            if (response.ok) {
                const updatedClasses = await response.json();
                console.log('Class added successfully:', updatedClasses);
                
                // Update local class arrays
                classesData = updatedClasses;
                classes = classesData.map(c => typeof c === 'object' ? c.name : c);
                
                // Update UI
                updateClassSelector();
                
                return true;
            } else {
                const error = await response.json();
                console.error('Error adding class:', error.detail);
                alert(`Error adding class: ${error.detail}`);
                return false;
            }
        } catch (error) {
            console.error('Error adding class:', error);
            alert(`Error adding class: ${error.message}`);
            return false;
        }
    }
    
    // Function to rename a class on the server
    async function renameClass(classIndex, newName) {
        try {
            const response = await fetch(`/classes/${classIndex}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ class_name: newName }),
            });
            
            if (response.ok) {
                const updatedClasses = await response.json();
                console.log('Class renamed successfully:', updatedClasses);
                
                // Update local class arrays
                classesData = updatedClasses;
                classes = classesData.map(c => typeof c === 'object' ? c.name : c);
                
                // Update UI
                updateClassSelector();
                
                alert(`Class renamed to "${newName}"`);
                return true;
            } else {
                const error = await response.json();
                console.error('Error renaming class:', error.detail);
                alert(`Error renaming class: ${error.detail}`);
                return false;
            }
        } catch (error) {
            console.error('Error renaming class:', error);
            alert(`Error renaming class: ${error.message}`);
            return false;
        }
    }
    
    // Function to delete a class from the server
    async function deleteClass(classIndex) {
        try {
            const response = await fetch(`/classes/${classIndex}`, {
                method: 'DELETE'
            });
            
            if (response.ok) {
                const updatedClasses = await response.json();
                console.log('Class deleted successfully:', updatedClasses);
                
                // Update local class arrays
                classesData = updatedClasses;
                classes = classesData.map(c => typeof c === 'object' ? c.name : c);
                
                // Update UI
                updateClassSelector();
                
                // Reset selected box class if it was using the deleted class
                boxes.forEach(box => {
                    if (box.class === classIndex) {
                        box.class = 0; // Reset to first class
                    } else if (box.class > classIndex) {
                        box.class--; // Adjust class index for boxes using higher indexes
                    }
                });
                
                // Redraw boxes with updated classes
                drawBoxes();
                updateBoxStats();
                
                alert(`Class deleted`);
                return true;
            } else {
                const error = await response.json();
                console.error('Error deleting class:', error.detail);
                alert(`Error deleting class: ${error.detail}`);
                return false;
            }
        } catch (error) {
            console.error('Error deleting class:', error);
            alert(`Error deleting class: ${error.message}`);
            return false;
        }
    }
    
    // Add predict button click handler
    if (predictBtn) {
        predictBtn.addEventListener('click', predictCurrentImage);
    } else {
        console.error("Predict button not found in the DOM. Check that the HTML includes the button element.");
    }
    
    // Add function to call the predict endpoint and process results
    async function predictCurrentImage() {
        console.log("Predicting image")
        if (!currentImage) {
            alert('Please select an image first');
            return;
        }
        
        try {
            // Show loading state
            loadingElement.style.display = 'block';
            loadingElement.textContent = 'Predicting...';
            
            // Call the predict endpoint
            const response = await fetch(`/predict/${encodeURIComponent(currentImage)}`);
            
            if (response.ok) {
                const result = await response.json();
                console.log('Prediction result:', result);
                
                let totalBoxes = 0;
                let shouldReplace = false;
                
                // Check if we have any predictions to add
                const hasPredictions = result.predictions && 
                    Array.isArray(result.predictions) && 
                    result.predictions.length > 0;
                
                if (hasPredictions) {
                    // Ask user if they want to replace or merge with existing boxes
                    if (boxes.length > 0) {
                        shouldReplace = confirm('Replace existing boxes with predictions? Click OK to replace, or Cancel to add predictions to existing boxes.');
                    }
                    
                    // Clear existing boxes if replacing
                    if (shouldReplace) {
                        boxes = [];
                    }
                    
                    // Process each prediction result
                    result.predictions.forEach(predictionResult => {
                        // Each prediction result contains a boxes array
                        if (predictionResult.boxes && Array.isArray(predictionResult.boxes)) {
                            // Process each box in the current prediction
                            predictionResult.boxes.forEach(box => {
                                try {
                                    let x, y, width, height;
                                    
                                    // If absolute coordinates are provided (x1,y1,x2,y2), use those
                                    if (box.x1 !== undefined && box.y1 !== undefined && 
                                        box.x2 !== undefined && box.y2 !== undefined) {
                                        x = Math.round(box.x1);
                                        y = Math.round(box.y1);
                                        width = Math.round(box.x2 - box.x1);
                                        height = Math.round(box.y2 - box.y1);
                                    } 
                                    // Otherwise, use normalized coordinates
                                    else if (box.x_center !== undefined && box.y_center !== undefined &&
                                             box.width !== undefined && box.height !== undefined) {
                                        x = Math.round((box.x_center - box.width/2) * canvas.width);
                                        y = Math.round((box.y_center - box.height/2) * canvas.height);
                                        width = Math.round(box.width * canvas.width);
                                        height = Math.round(box.height * canvas.height);
                                    } else {
                                        console.error('Box missing required coordinates:', box);
                                        return; // Skip this box
                                    }
                                    
                                    // Handle class mapping
                                    let classIndex = 0;
                                    // First try to use the class name if provided
                                    if (box.name) {
                                        const nameIndex = classes.findIndex(c => 
                                            c.toLowerCase() === box.name.toLowerCase());
                                        if (nameIndex !== -1) {
                                            classIndex = nameIndex;
                                        }
                                    } 
                                    // Fall back to class index if provided and valid
                                    else if (box.class !== undefined && box.class < classes.length) {
                                        classIndex = box.class;
                                    }
                                    
                                    // Add box with prediction flag
                                    boxes.push({
                                        x,
                                        y,
                                        width,
                                        height,
                                        class: classIndex,
                                        confidence: box.confidence || null,
                                        isPredicted: true, // Flag to identify predicted boxes
                                        name: box.name // Save original name for reference
                                    });
                                    
                                    totalBoxes++;
                                } catch (error) {
                                    console.error('Error processing prediction box:', error, box);
                                }
                            });
                        }
                    });
                    
                    // Update UI
                    selectedBoxIndex = -1; // Deselect any selected box
                    drawBoxes();
                    updateBoxStats();
                    
                    alert(`Added ${totalBoxes} predicted boxes`);
                } else {
                    alert('No predictions found for this image');
                }
            } else {
                const error = await response.json();
                console.error('Prediction error:', error);
                alert(`Error during prediction: ${error.detail || 'Unknown error'}`);
            }
        } catch (error) {
            console.error('Error calling predict endpoint:', error);
            alert(`Error: ${error.message}`);
        } finally {
            // Hide loading indicator
            loadingElement.style.display = 'none';
        }
    }
    
    // Initialize the app with a slight delay to make sure the app is fully loaded
    console.log('Initializing YOLO Image Labeler...');
    
    // First load classes, then load image list
    loadClasses().then(success => {
        if (success) {
            setTimeout(() => {
                loadImageList();
                setupFileUpload(); // Set up file upload after initialization
            }, 100);
        } else {
            // If classes failed to load, try again
            setTimeout(() => {
                loadClasses().then(() => {
                    loadImageList();
                    setupFileUpload(); // Set up file upload after initialization
                });
            }, 1000);
        }
    });
});