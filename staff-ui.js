document.addEventListener('DOMContentLoaded', () => {
    // --- GLOBAL VARIABLES & ELEMENT SELECTORS ---
    const user = JSON.parse(sessionStorage.getItem('collegeUser'));

    const ticketListTitle = document.getElementById('ticket-list-title');
    const ticketListItems = document.getElementById('ticket-list-items');
    const ticketDetailPlaceholder = document.querySelector('.ticket-detail-placeholder');
    const ticketDetailContent = document.querySelector('.ticket-detail-content');
    
    const filterButtons = document.querySelectorAll('.sidebar li');
    const ticketManagerPanels = document.querySelectorAll('.ticket-list, .ticket-detail');
    const kbPanel = document.querySelector('.knowledge-base-manager');
    
    // KB Modal elements
    const kbModal = document.getElementById('kb-modal');
    const kbForm = document.getElementById('kb-form');
    const modalTitle = document.getElementById('modal-title');
    const articleIdInput = document.getElementById('kb-article-id');
    const topicInput = document.getElementById('kb-topic');
    const contentInput = document.getElementById('kb-content');
    const kbTableBody = document.getElementById('kb-table-body');
    
    // Ticket Detail elements
    const assignBtn = document.getElementById('assign-btn');
    const resolveBtn = document.getElementById('resolve-btn');
    const currentTicketIdInput = document.getElementById('current-ticket-id');

    let currentTickets = []; // Holds the currently displayed list of tickets
    let allKBArticles = []; // This will hold the KB articles

    // --- INITIALIZATION ---
    if (!user || user.user_type !== 'staff') {
        alert("Access Denied. Please log in as a staff member.");
        window.location.href = 'login.html';
        return;
    }

    // Load the "New Tickets" view by default
    fetchTickets('new');

    // --- EVENT LISTENERS ---

    // Sidebar filter clicks
    filterButtons.forEach(button => {
        button.addEventListener('click', () => {
            const filter = button.getAttribute('data-filter');
            if (button.classList.contains('active') && filter !== 'knowledge-base') return;

            filterButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            if (filter === 'knowledge-base') {
                ticketManagerPanels.forEach(p => p.style.display = 'none');
                kbPanel.style.display = 'block';
                fetchAndRenderKB();
            } else {
                ticketManagerPanels.forEach(p => p.style.display = 'flex');
                kbPanel.style.display = 'none';
                ticketListTitle.textContent = button.textContent.trim();
                fetchTickets(filter);
            }
        });
    });

    // Ticket list click (using event delegation)
    ticketListItems.addEventListener('click', (e) => {
        const card = e.target.closest('.ticket-card');
        if (card) {
            document.querySelectorAll('.ticket-card').forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            const ticketId = card.getAttribute('data-ticket-id');
            showTicketDetails(ticketId);
        }
    });

    // Ticket action button clicks
    assignBtn.addEventListener('click', assignTicket);
    resolveBtn.addEventListener('click', resolveTicket);

    // Logout button
    document.getElementById('logout-btn').addEventListener('click', () => {
        sessionStorage.removeItem('collegeUser');
        window.location.href = 'login.html';
    });


    // --- TICKET MANAGEMENT FUNCTIONS ---

    async function fetchTickets(filter) {
        let url = '';
        // Use the correct filter names from your HTML
        if (filter === 'new' || filter === 'resolved') {
            url = `http://localhost:3000/api/tickets/department/${user.department_id}?status=${filter}`;
        } else if (filter === 'assigned' || filter === 'my-tickets') { // Handles both possibilities
            url = `http://localhost:3000/api/tickets/staff/${user.id}`;
        } else {
            return;
        }

        try {
            const response = await fetch(url);
            const result = await response.json();
            currentTickets = result.data;
            renderTicketList(currentTickets);

            if (!currentTickets || currentTickets.length === 0) {
                ticketDetailPlaceholder.style.display = 'flex';
                ticketDetailContent.style.display = 'none';
            } else {
                document.querySelector('.ticket-card')?.classList.add('active');
                showTicketDetails(currentTickets[0].id);
            }
        } catch (error) {
            console.error(`Failed to fetch ${filter} tickets:`, error);
            ticketListItems.innerHTML = '<p style="text-align: center; opacity: 0.7; padding: 20px;">Could not load tickets.</p>';
        }
    }

    function renderTicketList(tickets) {
        ticketListItems.innerHTML = '';
        if (!tickets || tickets.length === 0) {
            ticketListItems.innerHTML = '<p style="text-align: center; opacity: 0.7; padding: 20px;">No tickets found.</p>';
            return;
        }
        tickets.forEach(ticket => {
            const card = document.createElement('div');
            card.className = 'ticket-card';
            card.setAttribute('data-ticket-id', ticket.id);
            const statusClass = ticket.status === 'new' ? 'status-new' : 'status-progress';
            const urgencyClass = ticket.urgency === 'High' ? 'urgency-high' : '';
            card.innerHTML = `
                <div class="ticket-card-header">
                    <span class="ticket-card-id">#TKT-00${ticket.id}</span>
                    <span class="ticket-card-status ${statusClass}">${ticket.status}</span>
                </div>
                <p class="ticket-card-question">${ticket.question_text}</p>
                <div class="ticket-card-meta">
                    <span>From: ${ticket.student_username}</span>
                    <span class="${urgencyClass}">Urgency: ${ticket.urgency}</span>
                </div>`;
            ticketListItems.appendChild(card);
        });
    }

    function showTicketDetails(ticketId) {
        const ticket = currentTickets.find(t => t.id == ticketId);
        if (!ticket) {
            ticketDetailPlaceholder.style.display = 'flex';
            ticketDetailContent.style.display = 'none';
            return;
        }
        currentTicketIdInput.value = ticket.id;
        document.getElementById('detail-ticket-id').textContent = `#TKT-00${ticket.id}`;
        document.getElementById('detail-created-date').textContent = `Created: ${new Date(ticket.created_at).toLocaleString()}`;
        document.getElementById('detail-question-text').textContent = ticket.question_text;
        document.getElementById('detail-student-name').textContent = ticket.student_username;
        document.getElementById('detail-department').textContent = 'N/A';
        document.getElementById('detail-status').textContent = ticket.status;
        assignBtn.style.display = (ticket.status === 'new') ? 'block' : 'none';
        resolveBtn.style.display = (ticket.status === 'in_progress') ? 'block' : 'none';
        document.getElementById('answer-textarea').value = ticket.answer_text || '';
        ticketDetailPlaceholder.style.display = 'none';
        ticketDetailContent.style.display = 'block';
    }

    async function assignTicket() {
        const ticketId = currentTicketIdInput.value;
        try {
            await fetch(`http://localhost:3000/api/tickets/${ticketId}/assign`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ staffId: user.id })
            });
            const myTicketsButton = document.querySelector('li[data-filter="assigned"]');
            if (myTicketsButton) myTicketsButton.click();
        } catch (error) {
            console.error('Failed to assign ticket:', error);
        }
    }

    async function resolveTicket() {
        const ticketId = currentTicketIdInput.value;
        const answer = document.getElementById('answer-textarea').value;
        if (!answer) {
            alert('Please provide an answer before resolving the ticket.');
            return;
        }
        try {
            await fetch(`http://localhost:3000/api/tickets/${ticketId}/resolve`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ answer: answer })
            });
            const myTicketsButton = document.querySelector('li[data-filter="assigned"]');
            if (myTicketsButton) myTicketsButton.click();
        } catch (error) {
            console.error('Failed to resolve ticket:', error);
        }
    }

    // --- KNOWLEDGE BASE LOGIC (Full version) ---
    async function fetchAndRenderKB() {
        try {
            const response = await fetch('http://localhost:3000/api/kb');
            const result = await response.json();
            allKBArticles = result.data;
            renderKBTable(allKBArticles);
        } catch (error) {
            console.error("Failed to fetch KB articles:", error);
            kbTableBody.innerHTML = `<tr><td colspan="3" style="text-align:center;">Could not load data.</td></tr>`;
        }
    }

    function renderKBTable(articles) {
        kbTableBody.innerHTML = '';
        if (!articles || articles.length === 0) {
            kbTableBody.innerHTML = `<tr><td colspan="3" style="text-align:center;">No documents found.</td></tr>`;
            return;
        }
        articles.forEach(article => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${article.topic}</td>
                <td>${article.content}</td>
                <td>
                    <button class="action-btn edit-btn" data-id="${article.id}">Edit</button>
                    <button class="action-btn delete-btn" data-id="${article.id}">Delete</button>
                </td>
            `;
            kbTableBody.appendChild(row);
        });
    }

    function openKBModal(mode, article = {}) {
        modalTitle.textContent = mode === 'create' ? 'Add New Document' : 'Edit Document';
        articleIdInput.value = article.id || '';
        topicInput.value = article.topic || '';
        contentInput.value = article.content || '';
        kbModal.classList.remove('hidden');
    }

    function closeKBModal() {
        kbModal.classList.add('hidden');
    }

    async function handleKBSave(e) {
        e.preventDefault();
        const articleData = { topic: topicInput.value, content: contentInput.value, staff_id: user.id };
        const id = articleIdInput.value;
        const url = id ? `http://localhost:3000/api/kb/${id}` : 'http://localhost:3000/api/kb';
        const method = id ? 'PUT' : 'POST';
        try {
            await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(articleData) });
            closeKBModal();
            fetchAndRenderKB();
        } catch (error) { console.error("Failed to save article:", error); }
    }

    async function handleKBDelete(id) {
        if (!confirm('Are you sure?')) return;
        try {
            await fetch(`http://localhost:3000/api/kb/${id}`, { method: 'DELETE' });
            fetchAndRenderKB();
        } catch (error) { console.error("Failed to delete article:", error); }
    }

    kbPanel.addEventListener('click', e => {
        if (e.target.classList.contains('btn-add-new')) { openKBModal('create'); }
        if (e.target.classList.contains('edit-btn')) { const article = allKBArticles.find(a => a.id == e.target.dataset.id); openKBModal('edit', article); }
        if (e.target.classList.contains('delete-btn')) { handleKBDelete(e.target.dataset.id); }
    });

    kbForm.addEventListener('submit', handleKBSave);
    document.getElementById('cancel-btn').addEventListener('click', closeKBModal);
});
