import { io } from "https://cdn.socket.io/4.7.2/socket.io.esm.min.js";

const socket = io("http://localhost:3000", {
    transports: ["websocket"]
});

// Verifica se loginButton esiste prima di aggiungere l'event listener
const loginButton = document.querySelector("#loginButton");
if (loginButton) {
    const usernameInput = document.querySelector("#username");
    const passwordInput = document.querySelector("#password");

    loginButton.addEventListener("click", () => {
        const username = usernameInput.value;
        const password = passwordInput.value;

        socket.emit("login", username, password); // Invia nome e password al server
    });

    socket.on("loginSuccess", (userData) => {
        console.log("Login effettuato con successo!", userData);
        const userId = userData.userId; // <-- Assicurati che il server ti mandi l'id
        window.location.href = `index.html?userId=${encodeURIComponent(userId)}`;
    });

    socket.on("loginError", (errorMessage) => {
        console.error("Errore di login: ", errorMessage);
        alert(errorMessage);
    });
}

// Recupera l'userId dalla query string
const urlParams = new URLSearchParams(window.location.search);
const userId = urlParams.get("userId");

if (userId) {
    // Invia automaticamente l'userId al server
    socket.emit('sendUserId', userId);
}

// Verifica se gli elementi di index.html esistono prima di aggiungere gli event listener
const submitGroupId = document.querySelector("#submitGroupId");
const timerContainer = document.querySelector(".timerContainer");

if (submitGroupId && timerContainer) {
    let clientTimerIds = new Set();

    submitGroupId.addEventListener('click', () => {
        let groupId = document.querySelector("#groupId").value;
        socket.emit("enterGroup", groupId, userId);
    });

    timerContainer.addEventListener('click', (event) => {
        let timerId = Number(event.target.id.replace(/^\D+/g, ''));
        if (event.target.classList.contains("startStop")) {
            socket.emit("startStop", userId, timerId);
        }
        if (event.target.classList.contains("reset")) {
            socket.emit("resetTimer", userId, timerId);
        }
        if (event.target.classList.contains("delete")) {
            socket.emit("deleteTimer", userId, timerId);
        }
    });

    document.querySelector("#add").addEventListener('click', () => {
        let timerValue = document.querySelector("#timerValue").value;
        socket.emit("addTimer", userId, timerValue);
    });

    socket.on('updateTimer', (timerId, timerValue) => {
        if (clientTimerIds.has(timerId)) {
            document.querySelector("#timer" + timerId).textContent = timerValue;
        }
    });

    socket.on("initializeTimers", (timers) => {
        timers.forEach(timer => {
            if (!clientTimerIds.has(timer.id)) {
                clientTimerIds.add(timer.id);
                let htmlContent = `<p id='timer${timer.id}'>${timer.value}</p><button id='startStop${timer.id}' class='startStop'>Start</button>
                <button id='reset${timer.id}' class='reset'>reset</button>
                <button id='delete${timer.id}' class='delete'>delete</button>`;
                const newTimer = document.createElement('div');
                newTimer.classList.add("timer");
                newTimer.innerHTML = htmlContent;
                timerContainer.appendChild(newTimer);
            }
        });
    });

    socket.on('addClientTimer', (serverUserId, timerId, timerValue) => {
        if (userId == serverUserId && !clientTimerIds.has(timerId)) {
            clientTimerIds.add(timerId);
            let htmlContent = `<p id='timer${timerId}'>${timerValue}</p><button id='startStop${timerId}' class='startStop'>Start</button>
            <button id='reset${timerId}' class='reset'>reset</button>
            <button id='delete${timerId}' class='delete'>delete</button>`;
            const newTimer = document.createElement('div');
            newTimer.classList.add("timer");
            newTimer.innerHTML = htmlContent;
            timerContainer.appendChild(newTimer);
        }
    });

    socket.on("deleteClientTimer", timerId => {
        const timerElement = document.querySelector(`.timer:has(#timer${timerId})`);
        if (timerElement) {
            timerContainer.removeChild(timerElement);
            clientTimerIds.delete(timerId);
        }
    });
}

// Verifica se siamo nella pagina group.html
if (window.location.pathname.endsWith("group.html")) {
    const createGroupButton = document.querySelector("#createGroup");
    const groupNameInput = document.querySelector("#groupName");
    const userListContainer = document.querySelector("#userListContainer");

    let selectedUserIds = new Set();

    // Richiedi la lista degli utenti al server
    if (userId) {
        socket.emit("getUsers", userId);
    }

    // Ricevi la lista degli utenti dal server
    socket.on("usersList", (users) => {
        userListContainer.innerHTML = "<h3>Lista utenti:</h3>";
        users.forEach(user => {
            const userElement = document.createElement("div");
            userElement.classList.add("userItem");

            // Aggiungi un checkbox accanto al nome dell'utente
            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.dataset.userId = user.id;

            // Gestisci la selezione/deselezione tramite checkbox
            checkbox.addEventListener("change", (event) => {
                const userId = event.target.dataset.userId;
                if (event.target.checked) {
                    selectedUserIds.add(userId);
                } else {
                    selectedUserIds.delete(userId);
                }
            });

            userElement.appendChild(checkbox);
            userElement.appendChild(document.createTextNode(` ${user.name} (ID: ${user.id})`));
            userListContainer.appendChild(userElement);
        });
    });

    socket.on("usersError", (errorMessage) => {
        console.error("Errore:", errorMessage);
        alert(errorMessage);
    });

    // Crea un gruppo e invia gli inviti
    createGroupButton.addEventListener("click", () => {
        const groupName = groupNameInput.value;

        if (!groupName || selectedUserIds.size === 0) {
            alert("Inserisci un nome per il gruppo e seleziona almeno un utente.");
            return;
        }

        socket.emit("createGroup", groupName, userId, Array.from(selectedUserIds));
    });

    socket.on("groupCreated", (groupId, groupName, timerId) => {
        alert(`Gruppo "${groupName}" creato con successo!`);
    });

    socket.on("groupCreationError", (errorMessage) => {
        alert(errorMessage);
    });

    // Ricevi notifiche di invito
    socket.on(`groupInvite_${userId}`, ({ groupId, groupName, senderId }) => {
        const accept = confirm(`Sei stato invitato al gruppo "${groupName}" da userId ${senderId}. Accetti?`);
        if (accept) {
            socket.emit("acceptGroupInvite", groupId, userId);
        } else {
            socket.emit("declineGroupInvite", groupId, userId);
        }
    });

    socket.on("acceptInviteSuccess", (message) => {
        alert(message);
    });

    socket.on("acceptInviteError", (errorMessage) => {
        alert(errorMessage);
    });

    socket.on("declineInviteSuccess", (message) => {
        alert(message);
    });

    socket.on("declineInviteError", (errorMessage) => {
        alert(errorMessage);
    });
}

