document.addEventListener('DOMContentLoaded', () => {

    let allFAQs = [];

    const categoryIcons = {
        "All": "fas fa-globe-americas",
        "Admissions": "fas fa-user-plus",
        "Finance": "fas fa-dollar-sign",
        "Campus Life": "fas fa-university",
        "Academics": "fas fa-book-open",
        "IT Support": "fas fa-laptop-code" // Added a new icon
    };

    const faqList = document.getElementById('faq-list');
    const categoryList = document.getElementById('faq-categories');
    const searchInput = document.getElementById('faq-search');

    function renderFAQs(items) {
        faqList.innerHTML = '';
        if (!items || items.length === 0) {
            faqList.innerHTML = '<p style="text-align: center; color: var(--light-text);">No questions found.</p>';
            return;
        }
        items.forEach(faq => {
            const item = document.createElement('details');
            item.classList.add('faq-item');
            item.innerHTML = `
                <summary>${faq.question}</summary>
                <p>${faq.answer}</p>
            `;
            faqList.appendChild(item);
        });
    }
    
    function renderCategories(faqsData) {
        // Using Set to ensure categories are unique
        const categories = ['All', ...new Set(faqsData.map(faq => faq.category))];
        const ul = document.createElement('ul');
        categories.forEach(category => {
            const li = document.createElement('li');
            li.dataset.category = category;
            li.innerHTML = `<i class="${categoryIcons[category] || 'fas fa-question-circle'}"></i> ${category}`;
            if (category === 'All') {
                li.classList.add('active');
            }
            ul.appendChild(li);
        });
        categoryList.innerHTML = ''; // Clear previous categories before adding new ones
        categoryList.appendChild(ul);
    }

    // --- EVENT LISTENERS ---
    // (No changes needed for event listeners)
    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const filteredFAQs = allFAQs.filter(faq => 
            (faq.question && faq.question.toLowerCase().includes(searchTerm)) || 
            (faq.answer && faq.answer.toLowerCase().includes(searchTerm))
        );
        document.querySelectorAll('.faq-categories li').forEach(cat => cat.classList.remove('active'));
        document.querySelector('.faq-categories li[data-category="All"]').classList.add('active');
        renderFAQs(filteredFAQs);
    });

    categoryList.addEventListener('click', (e) => {
        if (e.target.tagName === 'LI') {
            const category = e.target.dataset.category;
            document.querySelectorAll('.faq-categories li').forEach(cat => cat.classList.remove('active'));
            e.target.classList.add('active');
            searchInput.value = '';
            if (category === 'All') {
                renderFAQs(allFAQs);
            } else {
                const filteredFAQs = allFAQs.filter(faq => faq.category === category);
                renderFAQs(filteredFAQs);
            }
        }
    });

    async function initializePage() {
        try {
            const response = await fetch('http://localhost:3000/api/faqs');
            const result = await response.json();
            if (result.message === "success") {
                allFAQs = result.data;
                renderCategories(allFAQs);
                renderFAQs(allFAQs);
            } else {
                console.error('Failed to fetch FAQs');
            }
        } catch (error) {
            console.error('Error fetching data:', error);
            faqList.innerHTML = '<p style="text-align: center; color: #ff6b6b;">Could not connect to the server.</p>';
        }
    }

    initializePage();
});