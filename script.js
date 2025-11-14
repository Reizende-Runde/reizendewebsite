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
    e.preventDefault(); // Prevent default link behavior
  
    // Check if the user is authenticated
    const user = auth.currentUser;
    if (user) {
      // User is already logged in
      window.location.href = '/Mitgliederbereich';
    } else {
      // Clear tokens in case of failed login previously
      sessionStorage.clear(); // Clears sessionStorage
      auth.signOut(); // Ensures no lingering Firebase auth state
  
      // Display the login modal
      modal.style.display = 'block';
    }
  });

  // Schließe das Modal beim Klicken auf das "X"
  closeModalBtn.addEventListener('click', () => {
    modal.style.display = 'none';
    clearLoginForm();
  });

const TERMINE_API_URL = 'https://script.google.com/macros/s/AKfycbxbXQTF5YEWCu8QSpSKag7regDQFxzzVR7_sakmAobusDIyeecwxEWMWhQrnLuPZXY/exec';

// Hilfsfunktion: dd.MM.yyyy -> Date-Objekt
function parseGermanDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const parts = dateStr.split('.');
  if (parts.length !== 3) return null;

  const [dayStr, monthStr, yearStr] = parts;
  const day = Number(dayStr);
  const month = Number(monthStr);
  const year = Number(yearStr);

  if (!day || !month || !year) return null;

  // Monat: 0-basiert
  return new Date(year, month - 1, day);
}

async function loadTermine() {
  try {
    const response = await fetch(TERMINE_API_URL);
    if (!response.ok) {
      throw new Error('HTTP-Fehler ' + response.status);
    }

    const termine = await response.json();

    // nach Datum sortieren (dd.MM.yyyy)
    termine.sort((a, b) => {
      const da = parseGermanDate(a.datum);
      const db = parseGermanDate(b.datum);
      if (!da || !db) return 0;
      return da - db;
    });

    const container = document.getElementById('termine-container');
    container.innerHTML = ''; // sicherheitshalber leeren

    if (!termine.length) {
      container.textContent = 'Aktuell sind keine Termine eingetragen.';
      return;
    }

    termine.forEach(t => {
      const p = document.createElement('p');

      const titel = t.titel || 'Termin';
      const datum = t.datum || '';
      const uhrzeit = t.uhrzeit ? `, ${t.uhrzeit} Uhr` : '';
      const ort = t.ort ? ` "${t.ort}"` : '';
      const info = t.info ? ` – ${t.info}` : '';

      p.innerHTML = `<b>${titel}</b> - ${datum}${uhrzeit}${ort}${info}`;
      container.appendChild(p);
    });

  } catch (err) {
    console.error('Fehler beim Laden der Termine:', err);
    const container = document.getElementById('termine-container');
    if (container) {
      container.textContent = 'Fehler beim Laden der Termine.';
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadTermine();
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
      window.location.href = '/Mitgliederbereich';
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
  
