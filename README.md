# schwarm-lernen-api Dokumentation

--------------------------------------------------------------------------------

## Allgemein
Dies ist eine REST-like API für das Projekt Schwarmlernen an der Hochschule Coburg. In diesem Dokument soll diese API näher beschrieben und dokumentiert werden.

## Verwendete Software
- node.js mit Express Framework
- Neo4J (Plugins: [http://graphaware.com/products/](http://graphaware.com/products/))

## Fehler
Üblicherweise sehen Fehler so aus:

```
{
    message: "Eine Klartextnachricht, die den Fehlerumstand beschreibt",
    error: {
        name: "StudiengangNotFound", // interner Name
        status: 404 // HTTP-Status
    }
}
```

Als HTTP-Statusmeldungen werden verwendet:
- **400** (Bad Request), falls der HTTP-Request fehlerhaft ist (z.B. fehlen benötigte Parameter)
- **401** (Unauthorized), falls der Client keinen Zugriff auf die spezifizierte Ressource besitzt
- **404** (Not Found), falls spezifische Ressource nicht gefunden wurde
- **409** (Conflict), falls eine Ressource erstellt werden soll, die bereits existiert oder eine Ressource nicht gelöscht werden konnte
- **500** (Internal), falls es einen internen Serverfehler gibt

## Routen
Im Folgenden werden die einzelnen API-Endpunkte beschrieben.
- Bei allgemeinen Routen wie `/degrees`: **Properties**, **Labels**, **Ref** pro Element
- Bei spezifischen Routen wie `/degrees/{id}`: **Properties**, **Labels**, **Ref**, **Relationsebene darüber**, **Relationsebene darunter** (falls verfügbar)

### Allgemein
Jede Instanz aller Ressourcen besitzt eine eindeutige UUID als Eigenschaft. Diese wird von der Datenbank bei der Erstellung einer neuen Node gesetzt.
- Falls bei PUT-/POST-Requests `uuid` als Attribut im Request-Body gesendet wird: **400**, "ValidationError"

### Authentifizierung
Alle Endpunkte können nur von authentifizierten Nutzern angesprochen werden. Hierbei wird zwischen `Usern` und `Admins` unterschieden.

Admins können alle Endpunkte ansprechen und sind zu allem berechtigt.

Gewöhnliche User hingegen können keine `Studiengänge` oder `Lernziele` erstellen, bearbeiten oder löschen.

Beim Anmelden werden `Username` und `Passwort` gegen ein JSON Webtoken ausgetauscht, welches den User authentifiziert. Dieses Token muss bei jedem Request (als URL-Parameter, im Request-Body oder im HTTP Header unter "X-Access-Token") mitgeschickt werden.

#### Routen

#### Registrierung
`POST /register` - Erstellt einen neuen Nutzer
* `username` - String, min. 4 Zeichen
* `password` - String, min. 5 Zeichen

#### Login
'POST /login' - Austausch von `Username` und `Passwort` gegen API-Token
* `username` - String
* `password` - String

### <a name="studiengang">Studiengänge (Degrees)</a>
Ein Studiengang ist der oberste Einstiegspunkt in unserer Hierarchie.

#### Nodeinformationen
`GET /degrees` - Liefert alle Module

`GET /degrees/:uuid` - Liefert Studiengang mit ID `:uuid`

`POST /degrees` - `ADMINONLY` - Erstellt einen neuen Studiengang
- Erforderliche Parameter: `name` - String, min. 3 Zeichen
- Falls Studiengang bereits besteht: **409**, "DegreeAlreadyExists"
- Falls Parameter fehlen **400**, "ValidationError"

`PUT /degrees/:uuid` - `ADMINONLY` - Aktualisiert den Studiengang `:uuid`
- Falls der neue Name von `:uuid` bereits existiert: **409**, "DegreeAlreadyExists"

`DELETE /degrees/:uuid` - `ADMINONLY` - Löscht den Studiengang `:uuid`
- Falls am Studiengang `:uuid` Beziehungen (z.B. zu Lernzielen) hängen: **409**, "RemainingRelationships"

#### Relationen
`GET /degrees/:uuid/targets` - Liefert Liste aller direkt benachbarten(!) Lernziele des Studiengangs `uuid`

`GET /degrees/:uuid/users` - Liefert Liste aller User die auf diesen Studiengang zugreifen können

### <a name="lernziel">Lernziele (Targets)</a>
Ein Lernziel hängt stets an exakt einem(!) [Studiengang](#studiengang) oder an exakt einem(!) anderen Lernziel und teilt dessen Themenbereich auf.

#### Node Properties
`GET /targets` - Liefert Liste aller Lernziele

`GET /targets/:uuid` - Liefert Lernziel `:uuid`

`POST /targets` - `ADMINONLY` - Erstellt ein neues Lernziel
- Erforderliche Parameter: `name` (String, min. 3 Zeichen), `parent` (String (UUID des Parents))
- Falls Parameter fehlen **400**, "ValidationError"
- Falls Parent `parent` nicht existiert: **404**, "ParentNotFound"

`PUT /targets/:uuid` - `ADMINONLY` - Aktualisiert Lernziel `:uuid`
- Falls `parent` gesetzt ist wird versucht die Parentnode entsprechend zu ändern

`DELETE /targets/:uuid` - `ADMINONLY` - Löscht Lernziel `:uuid`

#### Relationen
`GET /targets/:uuid/children` - Liefert alle direkten Kindnodes (Lernziele, Aufgaben und Infos) des Lernziels `:uuid`

`GET /targets/:uuid/targets` - Liefert alle direkt unterstellten Lernziele des Lernziels `:uuid`

`GET /targets/:uuid/tasks` - Liefert alle Aufgaben des Lernziels `:uuid`

`GET /targets/:uuid/infos` - Liefert alle Infos des Lernziels `:uuid`

`GET /targets/:uuid/parent` - Liefert Vaternode des Lernziels `:uuid`

### <a name="aufgabe">Aufgaben</a>
#### Node Properties
`GET /tasks` - Liefert Liste aller Aufgaben

`GET /tasks/:uuid` - Liefert Aufgabe mit UUID `uuid`

`POST /tasks` - Neue Aufgaben erstellen
- Erforderliche Parameter: `description` (String) Inhalt, `parent` (String) UUID des Lernziels der Aufgabe

#### Relationen
`GET /tasks/:uuid/solutions` - Liefert Liste aller Lösungen für Aufgabe `uuid`

Aufgaben können weder verändert noch gelöscht werden.

### <a name="info">Infos</a>
#### Node Properties
`GET /infos` - Liefert Liste aller Infos

`GET /infos/:uuid` - Liefert Info mit UUID `uuid`

`POST /infos` - Neue Infos erstellen
- Erforderliche Parameter: `description` (String) Inhalt, `target` (String) UUID des Lernziels der Info

#### Relationen
`GET /infos/:uuid/target` - Liefert Lernziel dem die Info mit der UUID `uuid` angehört

`GET /infos/:uuid/comments` - Liefert Kommentare für die Info mit der UUID `uuid`

Infos können weder verändert noch gelöscht werden.

### <a name="lösung">Lösungen</a>
#### Node Properties
`GET /solutions` - Liefert Liste aller Lösungen

`GET /solutions/:uuid` - Liefert Lösung mit UUID `uuid`

`POST /infos` - Neue Infos erstellen
- Erforderliche Parameter: `description` (String) Inhalt, `task` (String) UUID der Aufgabe der Lösung

#### Relationen
`GET /solutions/:uuid/task` - Liefert Aufgabe dem die Lösung mit der UUID `uuid` angehört

`GET /solutions/:uuid/comments` - Liefert Kommentare für die Lösung mit der UUID `uuid`

Lösungen können weder verändert noch gelöscht werden.

### <a name="benutzer">Benutzer</a>
#### Node Properties
`GET /users` - Liefert Liste aller User

`GET /users/:uuid` - Liefert User mit UUID `uuid`

#### Relationen
`GET /users/:uuid/infos` - Liefert Infos des Users mit der UUID `uuid`

`GET /users/:uuid/tasks/created` - Liefert erstellte Aufgaben des Users mit der UUID `uuid`

`GET /users/:uuid/tasks/solved` - Liefert bearbeitete Aufgaben des Users mit der UUID `uuid`

`GET /users/:uuid/solutions` - Liefert Lösungen des Users mit der UUID `uuid`
