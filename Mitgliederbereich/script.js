// Replace with your Firebase project configuration
const firebaseConfig = {

    apiKey: "AIzaSyAXnqylIvad60Aukj3DVNLoV-loRmZMd0g",
    authDomain: "reizendesbackend.firebaseapp.com",
    projectId: "reizendesbackend",
    storageBucket: "reizendesbackend.firebasestorage.app",
    messagingSenderId: "239229132288",
    appId: "1:239229132288:web:a398a64dba3fb0c7fac2e5"

    };


      firebase.initializeApp(firebaseConfig);
        const auth = firebase.auth();
        const db = firebase.firestore();

        async function fetchProtectedContent() {
          const user = auth.currentUser;

          if (!user) {
            window.location.href = "../index.html";
            return;
          }
            //TODO: Fehlermeldungen überarbeiten 
          try {
            const doc = await db.collection("protectedContent").doc("MB").get();
            if (doc.exists) {
              const data = doc.data();
              console.log("Retrieved data:", data);

              // Update the content with Firestore data
              
              //Card1
                document.getElementById("c1img").src = data.Card1.image.src;
                document.getElementById("c1hrefimg").href = data.Card1.href;
                document.getElementById("c1img").alt = data.Card1.image.alt;
                document.getElementById("c1href").textContent = data.Card1.titel
                document.getElementById("c1href").href = data.Card1.href;
                document.getElementById("c1description").textContent = data.Card1.oneliner;
                document.getElementById("c1link").href = data.Card1.href;
                document.getElementById("c1link").textContent = data.Card1.linkText;

                //Card2
                document.getElementById("c2img").src = data.Card2.image.src;
                document.getElementById("c2hrefimg").href = data.Card2.href;
                document.getElementById("c2img").alt = data.Card2.image.alt;
                document.getElementById("c2href").textContent = data.Card2.title
                document.getElementById("c2href").href = data.Card2.href;
                document.getElementById("c2description").textContent = data.Card2.oneliner;
                document.getElementById("c2link").href = data.Card2.href;
                document.getElementById("c2link").textContent = data.Card2.linkText;

                //Card3
                document.getElementById("c3img").src = data.Card3.image.src;
                document.getElementById("c3hrefimg").href = data.Card3.href;
                document.getElementById("c3img").alt = data.Card3.image.alt;
                document.getElementById("c3href").textContent = data.Card3.title
                document.getElementById("c3href").href = data.Card3.href;
                document.getElementById("c3description").textContent = data.Card3.oneliner;
                document.getElementById("c3link").href = data.Card3.href;
                document.getElementById("c3link").textContent = data.Card3.linkText;
                
                //Card4
                document.getElementById("c4img").src = data.Card4.image.src;
                document.getElementById("c4hrefimg").href = data.Card4.href;
                document.getElementById("c4img").alt = data.Card4.image.alt;
                document.getElementById("c4href").textContent = data.Card4.title
                document.getElementById("c4href").href = data.Card4.href;
                document.getElementById("c4description").textContent = data.Card4.oneliner;
                document.getElementById("c4link").href = data.Card4.href;
                document.getElementById("c4link").textContent = data.Card4.linkText; 

                //Card5
                document.getElementById("c5img").src = data.Card5.image.src;
                document.getElementById("c5hrefimg").href = data.Card5.href;
                document.getElementById("c5img").alt = data.Card5.image.alt;
                document.getElementById("c5href").textContent = data.Card5.title
                document.getElementById("c5href").href = data.Card5.href;
                document.getElementById("c5description").textContent = data.Card5.oneliner;
                document.getElementById("c5link").href = data.Card5.href;
                document.getElementById("c5link").textContent = data.Card5.linkText; 

                //Card6
                // document.getElementById("c6img").src = data.Card6.image.src;
                // document.getElementById("c6hrefimg").href = data.Card6.href;
                // document.getElementById("c6img").alt = data.Card6.image.alt;
                // document.getElementById("c6href").textContent = data.Card6.title
                // document.getElementById("c6href").href = data.Card6.href;
                // document.getElementById("c6description").textContent = data.Card6.oneliner;
                // document.getElementById("c6link").href = data.Card6.href;
                // document.getElementById("c6link").textContent = data.Card6.linkText; 

                //Card7
                // document.getElementById("c7img").src = data.Card7.image.src;
                // document.getElementById("c7hrefimg").href = data.Card7.href;
                // document.getElementById("c7img").alt = data.Card7.image.alt;
                // document.getElementById("c7href").textContent = data.Card7.title
                // document.getElementById("c7href").href = data.Card7.href;
                // document.getElementById("c7description").textContent = data.Card7.oneliner;
                // document.getElementById("c7link").href = data.Card7.href;
                // document.getElementById("c7link").textContent = data.Card7.linkText; 

                //Card8 
                // document.getElementById("c8img").src = data.Card8.image.src;
                // document.getElementById("c8hrefimg").href = data.Card8.href;
                // document.getElementById("c8img").alt = data.Card8.image.alt;
                // document.getElementById("c8href").textContent = data.Card8.title
                // document.getElementById("c8href").href = data.Card8.href;
                // document.getElementById("c8description").textContent = data.Card8.oneliner;
                // document.getElementById("c8link").href = data.Card8.href;
                // document.getElementById("c8link").textContent = data.Card8.linkText; 


            } else {
              throw new Error("Kein Inhalt gefunden");
            }
          } catch (error) {
            console.error("Fehler beim Laden der Inhalte:", error);
            document.getElementById("loadingMessage").textContent =
              "Fehler beim Laden der Inhalte. Bitte versuche es später erneut.";
          }
        }

      // Check authentication state on page load
      auth.onAuthStateChanged((user) => {
        if (user) {
          fetchProtectedContent();
        } else {
          console.error("User not authenticated. Redirecting to login...");
          window.location.href = '..';
        }
      });

      // Logout functionality
      document.getElementById('logout').addEventListener('click', async () => {
        try {
          await auth.signOut();
          console.log("User logged out.");
          window.location.href = '..';
        } catch (error) {
          console.error("Error signing out:", error);
        }
      });