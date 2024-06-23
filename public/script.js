// global variables
const socket = io();
const pollsList = document.getElementById("pollsList");
const maxOptionLength = 400;
const maxOptions = 13;

// Function to check if user is authenticated
function isAuthenticated() {
  return sessionStorage.getItem("isLoggedIn") === "true";
}

// function to retrieve user ID
function getUserId() {
  return sessionStorage.getItem("userId");
}

function init() {
  if (!isAuthenticated()) {
    sessionStorage.setItem("returnTo", window.location.href);
    window.location.href = "/login";
  } else {
    const pollId = getUrlParameter("poll");
    if (pollId) {
      displayPollById(pollId);
      const createPollSection = document.querySelector(".create-poll-section");
      if (createPollSection) {
        createPollSection.style.display = "none";
      }
    } else {
      const createPollSection = document.querySelector(".create-poll-section");
      if (createPollSection) {
        createPollSection.style.display = "block";
      }
    }
  }
}

// Helper function to get URL parameters
function getUrlParameter(name) {
  name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
  const regex = new RegExp("[\\?&]" + name + "=([^&#]*)");
  const results = regex.exec(location.search);

  if (results === null) {
    // uses the modern approach as a fallback
    const url = new URL(window.location.href);
    return url.searchParams.get(name);
  }

  return decodeURIComponent(results[1].replace(/\+/g, " "));
}

// this fetches and display a specific poll by ID
async function displayPollById(pollId) {
  try {
    const response = await fetch(`/polls/${pollId}`);
    const poll = await response.json();
    if (!poll) {
      throw new Error("Poll not found");
    }

    pollsList.innerHTML = "";
    const pollElement = document.createElement("li");
    pollElement.className = "poll";
    pollElement.id = `poll-${poll._id}`;
    pollElement.innerHTML = `
      <h3>${poll.question}</h3>
      <ul class="options">
        ${poll.options
          .map(
            (option, index) => `
          <li>
            <button onclick="vote('${poll._id}', ${index})">${option}</button>
            <span id="poll-${poll._id}-option-${index}">${poll.votes[index]}</span>
          </li>
        `
          )
          .join("")}
      </ul>
      <p>Share this poll: <a href="${window.location.origin}?poll=${
      poll._id
    }">${window.location.origin}?poll=${poll._id}</a></p>
    `;
    pollsList.appendChild(pollElement);
  } catch (error) {
    console.error(error);
    showModal("Failed to load poll. Please try again.");
  }
}

// Handles voting
function vote(pollId, optionIndex) {
  if (!isAuthenticated()) {
    showModal("You must be logged in to vote.");
    return;
  }
  socket.emit("vote", { pollId, optionIndex, userId: getUserId() });
}

// Initialize page
init();

// socket basically handles real time updates to web apps
socket.on("pollCreated", (poll) => {
  addPollToDOM(poll);
});

socket.on("voteUpdated", (poll) => {
  updatePollInDOM(poll);
});

socket.on("error", (message) => {
  showModal(message);
});

// Function to add a specified number of options
function addSpecifiedOptions() {
  const optionCountInput = document.getElementById("optionCount");
  const count = parseInt(optionCountInput.value, 10);

  if (isNaN(count) || count < 1 || count > maxOptions) {
    showModal(`Please enter a number between 1 and ${maxOptions}. 😞`);
    return;
  }

  addMultipleOptions(count);
}

// recursive function to add multiple options
function addMultipleOptions(count) {
  if (count <= 0) {
    return;
  }
  addOption();
  addMultipleOptions(count - 1);
}

// this function to add a single option, addMultipleOption relies on it by calling it recursively
function addOption() {
  const pollOptions = document.getElementById("pollOptions");

  if (pollOptions.children.length >= maxOptions) {
    showModal(`You cannot add more than ${maxOptions} options. 😞`);
    return;
  }

  const newOption = document.createElement("input");
  newOption.type = "text";
  newOption.placeholder = `Option ${pollOptions.children.length + 1}`;
  newOption.maxLength = maxOptionLength;
  newOption.addEventListener("input", handleOptionInput);
  pollOptions.appendChild(newOption);
}

// this function is self explanatory
function handleOptionInput(event) {
  if (event.target.value.length > maxOptionLength) {
    event.target.value = event.target.value.slice(0, maxOptionLength);
    showModal(`Option cannot be longer than ${maxOptionLength} characters. 😞`);
  }
}

// added recursive function, to add multiple options
function addMultipleOptions(count) {
  if (count <= 0) {
    return;
  }
  addOption();
  addMultipleOptions(count - 1);
}

// function to create a new poll
function createPoll() {
  const pollQuestion = document.getElementById("pollQuestion").value;
  const pollOptions = Array.from(
    document.getElementById("pollOptions").children
  )
    .map((input) => input.value)
    .filter((option) => option.trim());

  // Check if there are at least 2 options
  if (pollOptions.length < 2) {
    showModal("You cannot create a poll with less than 2 options. 😞");
    return;
  }
  // Loops through the options character length if it's longer than the specified amount, throw the exception err.
  for (let option of pollOptions) {
    if (option.length > maxOptionLength) {
      showModal(
        `Each option cannot be longer than ${maxOptionLength} characters. 😞`
      );
      return;
    }
  }

  socket.emit("createPoll", {
    question: pollQuestion,
    options: pollOptions,
    userId: getUserId(),
  });
  clearInputFields();
}

// created to be used in several places, major function is to clear user question and options input box after successful poll creation
function clearInputFields() {
  document.getElementById("pollQuestion").value = "";
  const pollOptions = document.getElementById("pollOptions").children;
  for (let option of pollOptions) {
    option.value = "";
  }
}

// afer successful creation, this function basically displays the newly createdd poll to the clients polls section
function addPollToDOM(poll) {
  const pollElement = document.createElement("li");
  pollElement.className = "poll";
  pollElement.id = `poll-${poll._id}`;
  pollElement.innerHTML = `
    <h3>${poll.question}</h3>
    <ul class="options">
      ${poll.options
        // incorporated the ES6 array function here
        .map(
          (option, index) => `
          <li>
            <button onclick="vote('${poll._id}', ${index})">${option}</button>
            <span id="poll-${poll._id}-option-${index}">${poll.votes[index]}</span>
          </li>
        `
        )
        .join("")}
    </ul>
    <p>Share this poll: <a href="${window.location.origin}?poll=${poll._id}">${
    window.location.origin
  }?poll=${poll._id}</a></p>
  `;
  pollsList.appendChild(pollElement);
}

// basically updates or add the new votes to dom after each successful vote
function updatePollInDOM(poll) {
  poll.options.forEach((option, index) => {
    const voteCount = document.getElementById(
      `poll-${poll._id}-option-${index}`
    );
    if (voteCount) {
      voteCount.textContent = poll.votes[index];
    }
  });
}

// function vote(pollId, optionIndex) {
//   socket.emit("vote", { pollId, optionIndex, userId: getUserId() });
// }

// This function basically shows a modal box with an exception thrown to a user
function showModal(message) {
  const modal = document.getElementById("errorModal");
  const errorMessage = document.getElementById("errorMessage");
  errorMessage.textContent = message;
  modal.style.display = "block";
}

// closes the modal
function closeModal() {
  const modal = document.getElementById("errorModal");
  modal.style.display = "none";
}

// same with close modal but in this case users can click outside the modal box to close
function closeModalOutside(event) {
  const modal = document.getElementById("errorModal");
  if (event.target === modal) {
    modal.style.display = "none";
  }
}
