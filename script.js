// Firebase-Konfiguration ersetzen
  const firebaseConfig = {

    apiKey: "AIzaSyAXnqylIvad60Aukj3DVNLoV-loRmZMd0g",

    authDomain: "reizendesbackend.firebaseapp.com",

    projectId: "reizendesbackend",

    storageBucket: "reizendesbackend.firebasestorage.app",

    messagingSenderId: "239229132288",

    appId: "1:239229132288:web:a398a64dba3fb0c7fac2e5"

    };


  // Firebase initialisieren
  firebase.initializeApp(firebaseConfig);
  const auth = firebase.auth();

  // Modal-Elemente
  const modal = document.getElementById('loginModal');
  const openModalBtn = document.getElementById('openLoginModal');
  const closeModalBtn = document.querySelector('.close-button');

  // Öffne das Modal beim Klicken auf den "Mitgliederbereich"-Button
  openModalBtn.addEventListener('click', (e) => {
    e.preventDefault(); // Verhindert das Standardverhalten des Links
    
      firebase.auth().onAuthStateChanged(user => {
        if (user) {
          // User is not authenticated; redirect to login page
          window.location.href = '/Mitgliederbereich/';
        } else {
          modal.style.display = 'block';
        }
      });

  });

  // Schließe das Modal beim Klicken auf das "X"
  closeModalBtn.addEventListener('click', () => {
    modal.style.display = 'none';
    clearLoginForm();
  });

  // Schließe das Modal beim Klicken außerhalb des Modal-Inhalts
  window.addEventListener('click', (event) => {
    if (event.target == modal) {
      modal.style.display = 'none';
      clearLoginForm();
    }
  });

  // Handle Login Form Submission
  document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault(); // Verhindert das Standardformularverhalten

    const email = document.getElementById('modal-email').value.trim();
    const password = document.getElementById('modal-password').value.trim();
    const errorDiv = document.getElementById('modal-error');

    try {
      // Anmeldung mit Firebase Authentication
      const userCredential = await auth.signInWithEmailAndPassword(email, password);
      // Holen Sie sich den ID-Token des Benutzers (optional, falls benötigt)
      const idToken = await userCredential.user.getIdToken();
      // Speichern Sie den Token in sessionStorage (optional)
      sessionStorage.setItem('idToken', idToken);
      // Schließen Sie das Modal
      modal.style.display = 'none';
      // Zur geschützten Seite weiterleiten
      window.location.href = '/Mitgliederbereich/index.html';
    } catch (error) {
      console.error('Fehler beim Anmelden:', error);
      errorDiv.textContent = error.message;
    }
  });

  // Funktion zum Zurücksetzen des Login-Formulars
  function clearLoginForm() {
    document.getElementById('loginForm').reset();
    document.getElementById('modal-error').textContent = '';
  }


document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      e.preventDefault();
  
      const targetId = this.getAttribute('href').substring(1);
      const targetElement = document.getElementById(targetId);
  
      if (targetElement) {
        const offset = 40; // Höhe des Sticky-Headers
        const elementPosition = targetElement.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.scrollY - offset;
  
        window.scrollTo({
          top: offsetPosition,
          behavior: 'smooth'
        });
      }
    });
  });
  