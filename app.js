// This script automatically renders your projects from the projects.js file
// No need to edit this file - just update projects.js to add new projects!

document.addEventListener('DOMContentLoaded', function() {
    const projectsContainer = document.getElementById('projects');
    const modal = document.getElementById('projectModal');
    const modalBody = document.getElementById('modalBody');
    const closeButton = document.querySelector('.close-button');

    // Render each project
    projects.forEach((project, index) => {
        const projectCard = document.createElement('div');
        projectCard.className = 'project-card';
        projectCard.style.cursor = 'pointer';

        // Create media element (image or video)
        let mediaHTML = '';
        if (project.mediaType === 'video') {
            mediaHTML = `
                <div class="project-media">
                    <video controls>
                        <source src="${project.mediaSrc}" type="video/mp4">
                        Your browser does not support the video tag.
                    </video>
                </div>
            `;
        } else {
            mediaHTML = `
                <div class="project-media">
                    <img src="${project.mediaSrc}" alt="${project.title}">
                </div>
            `;
        }

        // Create tags HTML
        const tagsHTML = project.tags.map(tag =>
            `<span class="tag">${tag}</span>`
        ).join('');

        // Build the complete card
        projectCard.innerHTML = `
            ${mediaHTML}
            <div class="project-info">
                <h3>${project.title}</h3>
                <p>${project.description}</p>
                <p class="project-date">${project.date}</p>
                <div class="project-tags">
                    ${tagsHTML}
                </div>
            </div>
        `;

        // Add click event to open modal
        projectCard.addEventListener('click', () => openModal(project));

        projectsContainer.appendChild(projectCard);
    });

    // Function to open modal with project details
    function openModal(project) {
        // Create media element for modal
        let modalMediaHTML = '';
        if (project.mediaType === 'video') {
            modalMediaHTML = `
                <video controls style="width: 100%; max-height: 400px; margin-bottom: 20px;">
                    <source src="${project.mediaSrc}" type="video/mp4">
                    Your browser does not support the video tag.
                </video>
            `;
        } else {
            modalMediaHTML = `
                <img src="${project.mediaSrc}" alt="${project.title}"
                     style="width: 100%; max-height: 400px; object-fit: cover; margin-bottom: 20px; border-radius: 8px;">
            `;
        }

        // Create tags HTML
        const tagsHTML = project.tags.map(tag =>
            `<span class="tag">${tag}</span>`
        ).join('');

        // Build modal content
        modalBody.innerHTML = `
            <h1 style="color: #00ff88; margin-bottom: 10px;">${project.title}</h1>
            <p style="color: #808080; font-style: italic; margin-bottom: 20px;">${project.date}</p>
            <div style="margin-bottom: 20px;">
                ${tagsHTML}
            </div>
            ${modalMediaHTML}
            <div class="writeup-content">
                ${project.fullWriteup || `<p>${project.description}</p>`}
            </div>
        `;

        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden'; // Prevent scrolling
    }

    // Function to close modal
    function closeModal() {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto'; // Re-enable scrolling
    }

    // Close button event
    closeButton.addEventListener('click', closeModal);

    // Close when clicking outside the modal content
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.style.display === 'flex') {
            closeModal();
        }
    });
});
