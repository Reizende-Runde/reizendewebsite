  document.addEventListener('DOMContentLoaded', () => {
      const form = document.getElementById('skatForm');
    
      // Radio-Toggle-Logik: Bei erneutem Klick auf bereits ausgewähltes Radio abwählen
      document.querySelectorAll('input[type=radio]').forEach(radio => {
          let wasChecked = false;
        
          radio.addEventListener('click', (e) => {
            // Wenn das Radio bereits checked war und erneut geklickt wird:
            if (radio.checked && wasChecked) {
              // Abwählen
              radio.checked = false;
              wasChecked = false;
              // PreventDefault könnte hier sogar entfallen,
              // da wir bereits den checked-Status verändert haben.
              e.preventDefault();
            } else {
              // Beim ersten Klick (Radio war zuvor nicht checked)
              wasChecked = radio.checked; // jetzt ist es checked = true
            }
          });
        });
        
      // Dropdown-Faktor: Wenn Wert gewählt ist, Radio "dropdown" auswählen
      const dropdownRadio = form.querySelector('input[name="faktor"][value="dropdown"]');
      const dropdownSelect = form.querySelector('select[name="faktorDropdown"]');
      dropdownSelect.addEventListener('change', () => {
        if (dropdownSelect.value !== "") {
          dropdownRadio.checked = true;
        }
      });
    
      // Optionen-Logik mit erweiterter Funktionalität
      const optionenInputs = Array.from(form.querySelectorAll('input[name="optionen"]'));

  // Which options should auto-select all predecessors?
  const autoSelectAllPrevious = ["Schneider angesagt", "Schwarz angesagt", "Ouvert"];

  optionenInputs.forEach((input, i) => {
    input.addEventListener('change', () => {
      if (input.checked) {
        // 1) If box is one of autoSelectAllPrevious => check ALL boxes up to current
        if (autoSelectAllPrevious.includes(input.value)) {
          for (let j = 0; j <= i; j++) {
            optionenInputs[j].checked = true;
          }
        }
        // 2) Special rule for "Schwarz": only auto-check "Schneider"
        else if (input.value === "Schwarz") {
          const schneiderIndex = optionenInputs.findIndex(
            opt => opt.value === "Schneider"
          );
          if (schneiderIndex !== -1) {
            optionenInputs[schneiderIndex].checked = true;
          }
        }
        // 3) Otherwise (Hand, Schneider, etc.), no auto-check logic needed
      } else {
        // Uncheck all subsequent boxes if the user unchecks this one
        for (let k = i + 1; k < optionenInputs.length; k++) {
          optionenInputs[k].checked = false;
        }
      }
    });
  });
      // Neue Logik für Null-Spielarten:
    const nullVariants = ['Null', 'Null Hand', 'Null Hand Ouvert', 'Null Ouvert'];
    const mitOhneRadios = form.querySelectorAll('input[name="mitOhne"]');
    const faktorRadios = form.querySelectorAll('input[name="faktor"]');
    const faktorDropdown = form.querySelector('select[name="faktorDropdown"]');
    const optionenCheckboxes = form.querySelectorAll('input[name="optionen"]');

    function updateStateForNullGame(isNullGame) {
      const inputsToDisable = [...mitOhneRadios, ...faktorRadios, ...optionenCheckboxes];
      
      inputsToDisable.forEach(input => {
        input.checked = false;
        input.disabled = isNullGame;
        const label = input.closest('label');
        if (label) {
          if (isNullGame) {
            label.classList.add('disabled');
          } else {
            label.classList.remove('disabled');
          }
        }
      });

      faktorDropdown.disabled = isNullGame;
      if (isNullGame) {
        faktorDropdown.value = '';
        faktorDropdown.closest('label')?.classList.add('disabled');
      } else {
        faktorDropdown.closest('label')?.classList.remove('disabled');
      }
    }

    const spielArtRadios = form.querySelectorAll('input[name="spielArt"]');
    spielArtRadios.forEach(radio => {
      radio.addEventListener('change', () => {
        const isNullGame = nullVariants.includes(radio.value);
        updateStateForNullGame(isNullGame);
      });
    });

      form.addEventListener('submit', function(event) {
        event.preventDefault();
    
        const spielArt = form.elements['spielArt'] ? form.elements['spielArt'].value : '';
        const ergebnis = form.elements['ergebnis'] ? form.elements['ergebnis'].value : '';
        const mitOhne = form.elements['mitOhne'] ? form.elements['mitOhne'].value : '';
    
        let faktor = null;
        let faktorRadioValue = form.elements['faktor'] ? form.elements['faktor'].value : '';
    
        if (faktorRadioValue && faktorRadioValue !== 'dropdown') {
          faktor = parseInt(faktorRadioValue, 10);
        } else if (faktorRadioValue === 'dropdown') {
          const dropdownValue = form.elements['faktorDropdown'].value;
          if (dropdownValue !== "") {
            faktor = parseInt(dropdownValue, 10);
          }
        }
    
        const optionen = Array.from(form.elements['optionen'] || [])
                              .filter(box => box.checked)
                              .map(box => box.value);
    
        const kontraRe = Array.from(form.elements['kontraRe'] || [])
                              .filter(box => box.checked)
                              .map(box => box.value);
    
        const baseValues = {
          'Karo': 9,
          'Herz': 10,
          'Pik': 11,
          'Kreuz': 12,
          'Grand': 24
        };
    
        let ergebnisFactor = 0;
        if (ergebnis === 'Gewonnen') ergebnisFactor = 1;
        else if (ergebnis === 'Verloren') ergebnisFactor = -2;
    
        const isNullGame = ['Null', 'Null Hand', 'Null Hand Ouvert', 'Null Ouvert'].includes(spielArt);
    
        let gameValue = 0;
        if (isNullGame && ergebnisFactor !== 0) {
          let base = 0;
          if (spielArt === 'Null') base = 23;
          else if (spielArt === 'Null Hand') base = 35;
          else if (spielArt === 'Null Hand Ouvert') base = 59;
          else if (spielArt === 'Null Ouvert') base = 46;
          gameValue = base * ergebnisFactor;
        } else if (baseValues[spielArt]) {
          const base = baseValues[spielArt];
          const usedFactor = faktor !== null ? faktor : 0;
          const multiplier = usedFactor + 1 + optionen.length;
          gameValue = base * multiplier * ergebnisFactor;
        }
    
        kontraRe.forEach(() => {
          gameValue = gameValue * 2;
        });
    
        let summaryParts = [];
        let baseStr = spielArt;
        if (mitOhne) baseStr += ` ${mitOhne}`;
        if (faktor !== null) baseStr += ` ${faktor}`;
        if (baseStr.trim()) summaryParts.push(baseStr.trim());
        if (optionen.length > 0) {
          summaryParts = summaryParts.concat(optionen);
        }
        if (kontraRe.includes("Kontra")) {
          summaryParts.push("Kontra angesagt");
        }
        if (kontraRe.includes("Re")) {
          summaryParts.push("Re angesagt");
        }
    
        const summaryStr = summaryParts.join(", ") + (ergebnis ? `: ${ergebnis}.` : '');
        document.getElementById('result').textContent = gameValue.toString();
        document.getElementById('summary').textContent = summaryStr;
    
        document.getElementById('resetForm').addEventListener('click', () => {
          form.reset();
        });
      });
    });
    