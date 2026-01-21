document.addEventListener('DOMContentLoaded', () => {
    const flipContainer = document.querySelector('.flip-container');
    const toRegisterLink = document.getElementById('flip-to-register');
    const toLoginLink = document.getElementById('flip-to-login');

    toRegisterLink.addEventListener('click', (e) => {
        e.preventDefault();
        flipContainer.classList.add('flipped');
    });

    toLoginLink.addEventListener('click', (e) => {
        e.preventDefault();
        flipContainer.classList.remove('flipped');
    });
});
