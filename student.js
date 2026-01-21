document.addEventListener('DOMContentLoaded', () => {
    
    // --- ELEMENT SELECTORS ---
    const studentNameElement = document.getElementById('student-name');
    const ticketListElement = document.getElementById('ticket-list');
    const questionForm = document.getElementById('question-form');
    const questionInput = document.getElementById('question-input');
    const chatMessages = document.getElementById('chat-messages');
    const logoutBtn = document.getElementById('logout-btn');
    
    // --- Get user info from session storage ---
    const user = JSON.parse(sessionStorage.getItem('collegeUser'));

    // If no user is logged in, redirect to login page
    if (!user) {
        window.location.href = 'login.html';
        return; // Stop the script
    }

    /**
     * Initializes the student dashboard.
     */
    function initializeDashboard() {
        // 1. Display the student's name
        studentNameElement.textContent = user.username;
        
        // 2. Fetch and display the student's tickets (both open and resolved)
        fetchAndRenderTickets();
    }

    /**
     * MODIFIED: This function now renders all tickets, including resolved ones and their answers.
     */
    async function fetchAndRenderTickets() {
        console.log("Current user object from sessionStorage:", user);
        console.log("Attempting to fetch tickets from URL:", `http://localhost:3000/api/tickets/student/${user.id}`);
        try {
            const response = await fetch(`http://localhost:3000/api/tickets/student/${user.id}`);
            const result = await response.json();

            ticketListElement.innerHTML = ''; // Clear existing placeholders
            
            if (result.data && result.data.length > 0) {
                result.data.forEach(ticket => {
                    const ticketDiv = document.createElement('div');
                    ticketDiv.className = 'ticket';
                    
                    // --- NEW: Handle different status styles ---
                    let statusClass = 'status-pending'; // Default for 'new'
                    if (ticket.status === 'in_progress') {
                        statusClass = 'status-progress';
                    } else if (ticket.status === 'resolved') {
                        statusClass = 'status-resolved';
                    }

                    // --- NEW: Add answer HTML if the ticket is resolved ---
                    let answerHtml = '';
                    if (ticket.status === 'resolved' && ticket.answer_text) {
                        answerHtml = `
                            <div class="ticket-answer">
                                <strong>Staff Answer:</strong>
                                <p>${ticket.answer_text}</p>
                            </div>
                        `;
                    }
                    
                    ticketDiv.innerHTML = `
                        <h4>#TKT-00${ticket.id}</h4>
                        <p class="ticket-question">"${ticket.question_text}"</p>
                        <div class="ticket-status ${statusClass}">Status: ${ticket.status}</div>
                        ${answerHtml} 
                    `;
                    ticketListElement.appendChild(ticketDiv);
                });
            } else {
                ticketListElement.innerHTML = '<p style="opacity: 0.7; text-align: center;">You have no tickets.</p>';
            }
        } catch (error) {
            console.error('Failed to fetch tickets:', error);
            ticketListElement.innerHTML = '<p style="color: #ff6b6b; text-align: center;">Could not load tickets.</p>';
        }
    }

    // --- EVENT LISTENERS ---
    questionForm.addEventListener('submit', handleQuestionSubmit);
    logoutBtn.addEventListener('click', () => {
        sessionStorage.removeItem('collegeUser'); // Clear user data on logout
        alert("Logging out...");
        window.location.href = 'login.html';
    });

    // --- FUNCTIONS from previous step (no changes needed below) ---
    async function handleQuestionSubmit(event) {
        event.preventDefault();
        const questionText = questionInput.value.trim();
        if (questionText === '') return;

        displayMessage(questionText, 'user');
        questionInput.value = '';

        const loadingMessage = displayMessage('...', 'bot', true);
        
        // Pass user ID along with the question
        const responseText = await getAIResponse(questionText, user.id);
        
        // If a ticket was created, refresh the ticket list
        if (responseText.includes("I have created a ticket for you")) {
            setTimeout(fetchAndRenderTickets, 1000); // Give server a moment to process
        }
        
        loadingMessage.querySelector('p').textContent = responseText;
        loadingMessage.classList.remove('loading');
    }

    function displayMessage(text, sender, isLoading = false) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', sender);
        if (isLoading) { messageDiv.classList.add('loading'); }
        const paragraph = document.createElement('p');
        if (sender === 'bot') {
            const icon = document.createElement('i');
            icon.className = 'fa fa-rocket bot-avatar';
            messageDiv.appendChild(icon);
        }
        paragraph.textContent = text;
        messageDiv.appendChild(paragraph);
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        return messageDiv;
    }

    async function getAIResponse(question, userId) {
        try {
            const response = await fetch('http://localhost:3000/api/ask', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ question: question, userId: userId }) // Send userId to server
            });
            if (!response.ok) { return "Sorry, there was an error connecting to the AI."; }
            const data = await response.json();
            return data.answer;
        } catch (error) {
            console.error("Fetch error:", error);
            return "I'm having trouble connecting. Please check your connection.";
        }
    }

    // --- INITIALIZE THE DASHBOARD ---
    initializeDashboard();
});