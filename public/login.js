// this function basically initializex Google Sign-In on window load
window.onload = function () {
  // this block initializes the Google Sign-In client with the client ID, callback function, and UX mode
  google.accounts.id.initialize({
    client_id:
      "516223757013-gac8jtj2qh6oohh320ja5l3qthk4u65s.apps.googleusercontent.com",
    callback: handleCredentialResponse,
    ux_mode: "popup",
  });

  //renders googles sign in btn within the element specified with Id buttonDiv
  google.accounts.id.renderButton(document.getElementById("buttonDiv"), {
    theme: "outline",
    size: "large",
  });

  google.accounts.id.prompt();
};

// callback function to handle the Google Sign-In credential respones
function handleCredentialResponse(response) {
  fetch("/auth/google", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ idToken: response.credential }),
  })
    .then((response) => {
      //checks if scuccesful response from server
      if (!response.ok) {
        throw new Error("Network response was not ok");
      }
      return response.json();
    })
    .then((data) => {
      if (data.success) {
        sessionStorage.setItem("isLoggedIn", "true");
        sessionStorage.setItem("userId", data.userId);
        console.log("User logged in:", data.userId);
        window.location.href = "/";
      } else {
        alert("Login Failed!");
      }
    })
    .catch((error) => {
      console.error("Error:", error);
      alert("An error occurred. Please try again.");
    });
}
