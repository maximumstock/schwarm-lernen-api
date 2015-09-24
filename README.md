# schwarm-lernen-api Dokumentation
Dies ist eine REST-like API für das Projekt Schwarmlernen an der Hochschule Coburg. In diesem Dokument soll diese API näher beschrieben und dokumentiert werden.

### Verwendete Software
- [node.js](https://nodejs.org/en/) mit [Express](http://expressjs.com/)-Framework
- [node-neo4j](https://github.com/thingdom/node-neo4j) Neo4J-Treiber für node.js
- Neo4J-Plugin zum automatischen Generieren von UUIDs für Nodes: [https://github.com/graphaware/neo4j-uuid](https://github.com/graphaware/neo4j-uuid)

### Datenmodell
Lorem ipsum dolor amet

### Authentifizierung
Alle Endpunkte können nur von authentifizierten Nutzern angesprochen werden. Hierbei wird zwischen `Usern` und `Admins` unterschieden.

Admins können alle Endpunkte ansprechen und sind zu allem berechtigt. Gewöhnliche User hingegen können keine `Studiengänge` oder `Lernziele` erstellen, bearbeiten oder löschen. Manche Endpunkte können also nur von Admins und manche von allen angesprochen werden. Von welchen Nutzergruppen ein bestimmter API-Endpunkt angesprochen werden kann sieht man an folgenden Kennzeichnungen bei den Routendefinitionen:

* `Public` - Nutzbar für jeden authentifizierten Benutzer und Admin
* `AccessRestricted` - Nutzbar für jeden Nutzer, der für den jeweiligen Studiengang angemeldet ist, und Admin
* `AuthorRestricted` - Nutzbar für den Autor der Resource und Admins (quasi ausschließlich für das Ändern und Löschen von selbst erstellten Aufgaben, Infos, Lösungen und Kommentaren
* `AdminOnly` - Nur von Admins nutzbar

Beim Anmelden werden `Username` und `Passwort` gegen ein [JSON Webtoken](https://en.wikipedia.org/wiki/JSON_Web_Token) ausgetauscht, welches den User authentifiziert. Dieses Token muss bei jedem Request (im HTTP Header unter "X-Access-Token") mitgeschickt werden. Ohne das Token kann ein User nicht authentifiziert und kein Request bearbeitet werden.

#### Login
`POST /login` - Austausch von `Username` und `Passwort` gegen ein API-Token

* `username` - String
* `password` - String

---

### Allgemein
Jede Instanz aller Ressourcen besitzt eine eindeutige UUID als Eigenschaft. Diese wird von der Datenbank bei der Erstellung einer neuen Node gesetzt. Falls bei `PUT`-/`POST`-Requests `uuid` als Attribut im Request-Body gesendet wird gilt dies als BadRequest, **400** - "ValidationError"

Außerdem können keine Resourcen gelöscht werden an denen noch Nodes/Beziehungen hängen. Dies ist ein internes Sicherheitsmerkmal von Neo4j und wird für diese API genutzt.

Beim erneuten `POST`-Requests an `/.../rating` zum Bewerten einer bereits bewerteten Ressource wird die alte Bewertung überschrieben

Alle Aufgaben, Infos und Lösungen haben einen Aktivitätsstatus, der als Property `status` mitgesendet wird. Inaktive Ressourcen werden unter anderem
nicht zur Erfüllung von Arbeitspaketen oder dem Gesamtkontostand eines Nutzers dazugezählt.

### Punktekonzept
Jeder Benutzer sammelt beim Einstellen eigener Inhalte, wie Aufgaben, Lösungen und Infos, aber auch für das Bewerten von fremden Inhalten Punkte.
Die Konfiguration des jeweiligen Studiengangs/Moduls bestimmt wie viele Punkte für die einzelnen Aktionen verdient und bezahlt werden.

### Bewertungskonzept
Alle Aufgaben, Lösungen und Informationen können von anderen Nutzern bewertet werden. Für das Bewerten von Inhalten bekommen sowohl die Bewertenden als auch die Bewerteten Nutzer Punkte. Siehe `Degrees/config` für weitere Informationen.

### Studiengänge/Degrees
* `GET /degrees` - Public - Alle Studiengänge
* `GET /degrees/:degreeUUID` - Public - Studiengang mit der ID `:degreeUUID`
* `GET /degrees/:degreeUUID/targets` - AccessRestricted - Alle Lernziele des Studiengangs `:degreeUUID`
* `GET /degrees/:degreeUUID/users` - AccessRestricted - Alle User die Zugriff auf den Studiengang `:degreeUUID` haben
* `GET /degrees/:degreeUUID/config` - AccessRestricted - Die Konfiguration des Studiengangs
* `POST /degrees` - AdminOnly - Neuen Studiengang erstellen
	* name - String, alphanumerisch - Name des neuen Studiengangs
	* Eine Standardkonfiguration wird hierbei erstellt: siehe [hier](#defaultconfig)
* `POST /degrees/:degreeUUID/targets` - AdminOnly - Ein neues Lernziel an den Studiengang `:degreeUUID` hängen
	* name - String - Name des neuen Lernziels
* `PUT /degrees/:degreeUUID/users` - AdminOnly - Generierung von Username-Passwort-Kombinationen, die Zugriff auf den Studiengang `:degreeUUID` haben
	* amount - Integer - Anzahl der zu generierenden Accounts
* `PUT /degrees/:degreeUUID` - AdminOnly - Studiengang mit der ID `:degreeUUID` aktualisieren
* `PUT /degrees/:degreeUUID/config` - AdminOnly - Konfiguration des Studiengangs `:degreeUUID` aktualisieren
* `DELETE /degrees/:degreeUUID` - AdminOnly - Studiengang mit der ID `:degreeUUID` löschen

* <a name="defaultconfig">Standardkonfiguration</a>:
	* packageSize - Integer - Gesamtgröße für neue Arbeitspakete - Default: 10
	* solutionShare - Integer - Prozentwert die Lösungen in einem Arbeitspaket ausmachen sollen - Default: 0%
	* infoShare - Integer - Prozentwert die Infos in einem Arbeitspaket ausmachen sollen - Default: 35%
	* taskShare - Integer - Prozentwert die Aufgaben in einem Arbeitspaket ausmachen sollen - Default: 50%
	* rateShare - Integer - Prozentwert die Bewertungen in einem Arbeitspaket ausmachen sollen - Default: 15%
	* solutionPoints - Integer - Anzahl der Punkte die jemand für das Einstellen einer Lösung erhalten soll - Default: 0
	* infoPoints - Integer - Anzahl der Punkte die jemand für das Einstellen einer Info erhalten soll - Default: 5
	* taskPoints - Integer - Anzahl der Punkte die jemand für das Einstellen einer Aufgabe erhalten soll - Default: 7
	* ratePoints - Integer - Anzahl der Punkte die jemand für das Bewerten von fremden Inhalten erhalten soll - Default: 1
	* solutionCost - Integer - Anzahl der Punkte die das Einstellen einer Lösung kosten soll - Default: 10
	* infoCost - Integer - Anzahl der Punkte die das Einstellen einer Info kosten soll - Default: 0
	* taskCost - Integer - Anzahl der Punkte die das Einstellen einer Aufgabe kosten soll - Default: 0
	* rateCost - Integer - Anzahl der Punkte die das Bewerten von Inhalten kosten soll - Default: 0
	* rateMultiplier - Integer - Multiplikator mit dem die durchschnittliche Bewertung von Inhalten verrechnet wird. Das Produkt wird auf die Gesamtpunktzahl der A/L/I addiert. - Default: 1

---
### Lernziele/Targets
* `GET /targets/:targetUUID` - AccessRestricted - Ein bestimmtes Lernziel mit der ID `:targetUUID`
* `GET /targets/:targetUUID/parent` - AccessRestricted - Die Vaternode des Lernziels; entweder ein Studiengang oder ein anderes Lernziel
* `GET /targets/:targetUUID/children` - AccessRestricted - Liefert alle Kind-Nodes des Lernziels `:targetUUID` sortiert nach **Tasks**, **Infos** und **Targets**
* `POST /targets/:targetUUID/targets` - AdminOnly - Erstellt ein neues Lernziel unter dem Lernziel `:targetUUID`
	* name - String - Name des neuen Lernziels
* `POST /targets/:targetUUID/tasks` - AccessRestricted - Erstellt eine neue Aufgabe unter dem Lernziel `:targetUUID`
	* description - String - Inhalt der neuen Aufgabe
* `POST /targets/:targetUUID/infos` - AccessRestricted - Erstellt eine neue Info unter dem Lernziel `:targetUUID`
	* description - String - Inhalt der neuen Aufgabe
* `PUT /targets/:targetUUID` - AdminOnly - Aktualsiert das Lernziel mit der ID `:targetUUID`
* `DELETE /targets/:targetUUID` - AdminOnly - Löscht das Lernziel mit der ID `:targetUUID`

---
### Aufgaben/Tasks
* `GET /tasks/:taskUUID` - AccessRestricted - Liefert die Aufgabe `:taskUUID`
* `GET /tasks/:taskUUID/target` - AccessRestricted - Lernziel an dem die Aufgabe `:taskUUID` hängt
* `GET /tasks/:taskUUID/rating` - AccessRestricted - Liefert alle Bewertungen der Aufgabe `:taskUUID` und die des aktuellen Users, falls vorhanden
* `GET /tasks/:taskUUID/solution` - AccessRestricted - Liefert die eine bestehende Lösung für den aktuellen User falls eine besteht
* `GET /tasks/:taskUUID/comments` - AccessRestricted - Liefert die Kommentare zur Aufgabe `:taskUUID`
* `GET /tasks/:taskUUID/solutions` - AccessRestricted - Alle Lösungen zur Aufgabe `:taskUUID`
* `POST /tasks/:taskUUID/comments` - AccessRestricted - Neuen Kommentar zur Aufgabe `:taskUUID` erstellen
	* comment - String - Inhalt des Kommentars
* `POST /tasks/:taskUUID/rating` - AccessRestricted - Neue Bewertung zur Aufgabe `:taskUUID` abgeben
	* r1, r2, r3, r4, r5 - Integer (0-5) - Werte für verschiedene Parameter (bisher ohne Zuordnung)
	* comment - String - Zusatzkommentar zur Bewertung
* `POST /tasks/:taskUUID/solutions` - AccessRestricted - Neue Lösung für die Aufgabe `:taskUUID`
	* description - String - Inhalt der Lösung
* `PUT /tasks/:taskUUID/status` - AdminOnly - Toggled den Aktivitätsstatus der Aufgabe

---
### Lösungen/Solutions
* `GET /solutions/:solutionUUID` - AccessRestricted - Liefert die Lösung `:solutionUUID`
* `GET /solutions/:solutionUUID/task` - AccessRestricted - Liefert die Aufgabe zur Lösung `:solutionUUID`
* `GET /solutions/:solutionUUID/rating` - AccessRestricted - Liefert alle Bewertungen der Lösung `:solutionUUID` und die des aktuellen Users, falls vorhanden
* `GET /solutions/:solutionUUID/comments` - AccessRestricted - Liefert die Kommentare zur Lösung `:solutionUUID`
* `POST /solutions/:solutionUUID/rating` - AccessRestricted - Abgeben einer Bewertung für die Lösung `:solutionUUID`
	* r1, r2, r3, r4, r5 - Integer (0-5) - Werte für verschiedene Parameter (bisher ohne Zuordnung)
	* comment - String - Zusatzkommentar zur Bewertung
* `POST /solutions/:solutionUUID/comments` - AccessRestricted - Erstellen eines Kommentars zur Lösung `:solutionUUID`
	* comment - String - Inhalt des Kommentars
* `PUT /solutions/:soltuionUUID/status` - AdminOnly - Toggled den Aktivitätsstatus der Lösung

---
### Infos
* `GET /infos/:infoUUID` - AccessRestricted - Liefert die Info `:infoUUID`
* `GET /infos/:infoUUID/target` - AccessRestricted -
* `GET /infos/:infoUUID/comments` - AccessRestricted - Alle Kommentare zur Info `:infoUUID`
* `GET /infos/:infoUUID/rating` - AccesssRestricted - Liefert alle Bewertungen der Info `:infoUUID` und die des aktuellen Users, falls vorhanden
* `POST /infos/:infoUUID/comments` - AccessRestricted - Erstellen eines neuen Kommentars zur Info `:infoUUID`
	* comment - String - Inhalt des Kommentars
* `POST /infos/:infoUUID/rating` - AccessRestricted - Abgeben einer Bewertung der Info `:infoUUID`
	* r1, r2, r3, r4, r5 - Integer (0-5) - Werte für verschiedene Parameter (bisher ohne Zuordnung)
	* comment - String - Zusatzkommentar zur Bewertung
* `PUT /infos/:infoUUID/status` - AdminOnly - Toggled den Aktivitätsstatus der Info

---
### Nutzerprofile
* `GET /self` - Kleines Inhaltsverzeichnis für die weitere Struktur
* `GET /self/solutions` - Liefert alle Lösungen des aktuellen Users
* `GET /self/tasks/created` - Liefert alle selbst erstellten Aufgaben des Users
* `GET /self/tasks/sovled` - Liefert alle vom aktuellen User gelösten Aufgaben
* `GET /self/infos` - Liefert alle Infos des aktuellen Users
* `GET /self/points` - Liefert Punktekonto des aktuellen Users
* `GET /self/workpackage` - Liefert die aktuelle Arbeitspaketsituation des Nutzers

---

## Fehler
Üblicherweise sehen Fehler so aus:

	{
	    message: "Eine Klartextnachricht, die den Fehlerumstand beschreibt",
			error: {
	        name: "StudiengangNotFound", // interner Name
	        status: 404 // HTTP-Status
	    }
	}

Als HTTP-Statusmeldungen werden verwendet:
- **400** (Bad Request), falls der HTTP-Request fehlerhaft ist (z.B. fehlen benötigte Parameter)
- **401** (Unauthorized), falls der Client keinen Zugriff auf die spezifizierte Ressource besitzt
- **404** (Not Found), falls spezifische Ressource nicht gefunden wurde
- **409** (Conflict), falls eine Ressource erstellt werden soll, die bereits existiert oder eine Ressource nicht gelöscht werden konnte
- **500** (Internal), falls es einen internen Serverfehler gibt
