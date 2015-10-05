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
* `AuthorOnly` - Nutzbar für den Autor der Resource und Admins (quasi ausschließlich für das Ändern und Löschen von selbst erstellten Aufgaben, Infos, Lösungen und Kommentaren
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
Jeder Benutzer sammelt <s>beim Einstellen eigener Inhalte, wie Aufgaben, Lösungen und Infos, aber auch</s> für das Bewerten von fremden Inhalten Punkte.
Die Konfiguration des jeweiligen Studiengangs/Moduls bestimmt wie viele Punkte <s>für die einzelnen Aktionen <s>verdient und bezahlt werden.


---
### Lernziele/Targets
* ***NEW*** `GET /targets` - Public - Liefert alle Hauptlernziele (`EntryTargets`)
* `GET /targets/:targetUUID` - AccessRestricted - Ein bestimmtes Lernziel mit der ID `:targetUUID`
* `GET /targets/:targetUUID/parent` - AccessRestricted - Die Vaternode des Lernziels
* `GET /targets/:targetUUID/children` - AccessRestricted - Liefert alle Kind-Nodes des Lernziels `:targetUUID` sortiert nach **Tasks**, **Infos** und **Targets**
* **NEW** `GET /targets/:targetUUID/config` - AccessRestricted - Liefert die Konfiguration des Lernziels bzw. die globale Konfiguration falls `:targetUUID` keine eigene Konfiguration hat
* `GET /targets/:targetUUID/users` - AccessRestricted - Liefert Liste alle Nutzer die auf dieses Lernziel Zugriff haben. Falls `:targetUUID` kein Hauptlernziel/EntryTarget ist, wird momentan ein leeres Array zurückgeliefert, da die Zugriffssteuerung über das verantwortliche Hauptlernziel läuft
* **NEW** `POST /targets` - AdminOnly - Erstellt ein neues Hauptlernziel
	* name - String - Name des neuen Lernziels - Max. Länge 50 Zeichen
* `POST /targets/:targetUUID/targets` - AdminOnly - Erstellt ein neues Lernziel unter dem Lernziel `:targetUUID`
	* name - String - Name des neuen Lernziels - Max. Länge 50 Zeichen
* `POST /targets/:targetUUID/tasks` - AccessRestricted - Erstellt eine neue Aufgabe unter dem Lernziel `:targetUUID`
	* description - String - Inhalt der neuen Aufgabe - Max. Länge 2000 Zeichen
* `POST /targets/:targetUUID/infos` - AccessRestricted - Erstellt eine neue Info unter dem Lernziel `:targetUUID`
	* description - String - Inhalt der neuen Aufgabe
* **NEW** `PUT /targets/:targetUUID` - AdminOnly - Aktualsiert das Lernziel mit der ID `:targetUUID`
* **NEW** `PUT /targets/:targetUUID/users` - AdminOnly - Generiert neue Accounts die Zugriff auf `:targetUUID` erhalten
	* amount - Integer - Anzahl an zu generierenden Usern - Max. 50 gleichzeitig
* **NEW** `PUT /targets/:targetUUID/config` - AdminOnly - Aktualisiert die Konfiguration von `:targetUUID` (Parameter siehe [Standardkonfiguration](#defaultconfig))
* `DELETE /targets/:targetUUID` - AdminOnly - Löscht das Lernziel mit der ID `:targetUUID`

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
	* *IGNORE* rateMultiplier - Integer - Multiplikator mit dem die durchschnittliche Bewertung von Inhalten verrechnet wird. Das Produkt wird auf die Gesamtpunktzahl der A/L/I addiert. - Default: 1

---
### Aufgaben/Tasks
* `GET /tasks/:taskUUID` - AccessRestricted - Liefert die Aufgabe `:taskUUID`
* `GET /tasks/:taskUUID/target` - AccessRestricted - Lernziel an dem die Aufgabe `:taskUUID` hängt
* `GET /tasks/:taskUUID/ratings` - AccessRestricted - Liefert alle Bewertungen der Aufgabe `:taskUUID`
* **NEW** `GET /tasks/:taskUUID/rating` - AccessRestricted - Liefert die eigene Bewertung für die Aufgabe `:taskUUID`, falls keine besteht **404**
* `GET /tasks/:taskUUID/solution` - AccessRestricted - Liefert die eine bestehende Lösung für den aktuellen User, falls keine besteht **404**
* `GET /tasks/:taskUUID/solutions` - AccessRestricted - Alle Lösungen zur Aufgabe `:taskUUID`
* **NEW** `POST /tasks/:taskUUID/ratings` - AccessRestricted - Neue Bewertung zur Aufgabe `:taskUUID` abgeben
	* values - Array - Array aus Integern, die die Einzelbewertungen für verschiedene Kriterien darstellen
	* names - Array - Array aus Strings mit den Bezeichnungen der einzelnen Kriterien
	* comment - String - Zusatzkommentar zur Bewertung - Max. Länge 1000 Zeichen
* `POST /tasks/:taskUUID/solutions` - AccessRestricted - Neue Lösung für die Aufgabe `:taskUUID`
	* description - String - Inhalt der Lösung - Max. Länge 2000 Zeichen
* **NEW** `PUT /tasks/:taskUUID` - AuthorOnly - Aktualisiert die Aufgabe
* `PUT /tasks/:taskUUID/status` - AdminOnly - Toggled den Aktivitätsstatus der Aufgabe
* **NEW** `PUT /tasks/:taskUUID/submit` - AuthorOnly - Gibt die Aufgabe ab, macht sie unveränderbar

---
### Lösungen/Solutions
* `GET /solutions/:solutionUUID` - AccessRestricted - Liefert die Lösung `:solutionUUID`
* `GET /solutions/:solutionUUID/task` - AccessRestricted - Liefert die Aufgabe zur Lösung `:solutionUUID`
* `GET /solutions/:solutionUUID/ratings` - AccessRestricted - Liefert alle Bewertungen der Lösung `:solutionUUID`
* **NEW** `GET /solutions/:solutionUUID/rating` - AccessRestricted - Liefert die eigene Bewertung für die Lösung `:solutionUUID`, falls keine besteht **404**
* **NEW** `POST /solutions/:solutionUUID/ratings` - AccessRestricted - Neue Bewertung zur Lösung `:solutionUUID` abgeben
	* values - Array - Array aus Integern, die die Einzelbewertungen für verschiedene Kriterien darstellen
	* names - Array - Array aus Strings mit den Bezeichnungen der einzelnen Kriterien
	* comment - String - Zusatzkommentar zur Bewertung - Max. Länge 1000 Zeichen
* **NEW** `PUT /solutions/:solutionUUID` - AuthorOnly - Aktualisiert die Lösung
* `PUT /solutions/:solutionUUID/status` - AdminOnly - Toggled den Aktivitätsstatus der Lösung
* **NEW** `PUT /solutions/:solutionUUID/submit` - AuthorOnly - Gibt die Lösung ab, macht sie unveränderbar

---
### Infos
* `GET /infos/:infoUUID` - AccessRestricted - Liefert die Info `:infoUUID`
* `GET /infos/:infoUUID/target` - AccessRestricted - Liefert das Lernziel zu dem die Info `:infoUUID` gehört
* `GET /infos/:infoUUID/ratings` - AccessRestricted - Liefert alle Bewertungen der Info `:infoUUID`
* **NEW** `GET /infos/:infoUUID/rating` - AccessRestricted - Liefert die eigene Bewertung für `:infoUUID`, falls keine besteht **404**
* **NEW** `POST /infos/:infoUUID/ratings` - AccessRestricted - Neue Bewertung zur Info `:infoUUID` abgeben
	* values - Array - Array aus Integern, die die Einzelbewertungen für verschiedene Kriterien darstellen
	* names - Array - Array aus Strings mit den Bezeichnungen der einzelnen Kriterien
	* comment - String - Zusatzkommentar zur Bewertung - Max. Länge 1000 Zeichen
* **NEW** `PUT /infos/:infoUUID` - AuthorOnly - Aktualisiert die Info
* `PUT /infos/:infoUUID/status` - AdminOnly - Toggled den Aktivitätsstatus der Info
* **NEW** `PUT /infos/:infoUUID/submit` - AuthorOnly - Gibt die Info ab, macht sie unveränderbar

---
### Nutzerprofile
* `GET /self` - Kleines Inhaltsverzeichnis für die weitere Struktur
* `GET /self/solutions` - Liefert alle Lösungen des aktuellen Users
* `GET /self/tasks/created` - Liefert alle selbst erstellten Aufgaben des Users
* `GET /self/tasks/sovled` - Liefert alle vom aktuellen User gelösten Aufgaben
* `GET /self/infos` - Liefert alle Infos des aktuellen Users
* `GET /self/points` - Liefert Punktekonto des aktuellen Users
* **NEW** `GET /self/prestige` - Liefert den aktuellen Prestige-/Rufwert des Nutzers
* `GET /self/workpackage` - Liefert die aktuelle Arbeitspaketsituation des Nutzers

---

## Fehler
Üblicherweise sehen Fehler so aus:

	{
	    message: "Eine Klartextnachricht, die den Fehlerumstand beschreibt",
			error: {
	        name: "TargetNotFound", // interner Name
	        status: 404 // HTTP-Status
	    }
	}

Als HTTP-Statusmeldungen werden verwendet:
- **400** (Bad Request), falls der HTTP-Request fehlerhaft ist (z.B. fehlen benötigte Parameter)
- **401** (Unauthorized), falls der Client keinen Zugriff auf die spezifizierte Ressource besitzt
- **404** (Not Found), falls spezifische Ressource nicht gefunden wurde
- **409** (Conflict), falls eine Ressource erstellt werden soll, die bereits existiert oder eine Ressource nicht gelöscht/geändert werden konnte
- **500** (Internal), falls es einen internen Serverfehler gibt
