// This script automatically renders your projects from the projects.js file
// No need to edit this file - just update projects.js to add new projects!

document.addEventListener('DOMContentLoaded', function() {
    const projectsContainer = document.getElementById('projects');

    // Render each project
    projects.forEach(project => {
        const projectCard = document.createElement('div');
        projectCard.className = 'project-card';

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

        projectsContainer.appendChild(projectCard);
    });
});
