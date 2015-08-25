# schwarm-lernen-api Dokumentation
---
## Allgemein
Dies ist eine REST-like API für das Projekt Schwarmlernen an der Hochschule Coburg.
In diesem Dokument soll diese API näher beschrieben und dokumentiert werden.

## Verwendete Software
* node.js mit Express Framework
* Neo4J (Plugins: http://graphaware.com/products/)

## Fehler
Üblicherweise sehen Fehler stets so aus: 

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

## Routen
Im Folgenden werden die einzelnen API-Endpunkte beschrieben.

Bei allgemeinen Routen wie `/degrees`: **Properties**, **Labels**, **Ref** pro Element
Bei spezifischen Routen wie `/degrees/{id}`: **Properties**, **Labels**, **Ref**, **L-1**, **L+1** (falls verfügbar)

### Allgemein
Jede Instanz aller Ressourcen besitzt eine eindeutige UUID als Eigenschaft. Diese wird von der Datenbank bei der Erstellung einer neuen Node gesetzt. 

- Falls bei PUT-/POST-Requests `uuid` als Attribut im Request-Body gesendet wird: **400**, "ValidationError"

### <a name="studiengang">Studiengänge (Degrees)</a>
Ein Studiengang ist der oberste Einstiegspunkt in unserer Hierarchie.

#### Nodeinformationen
**+**`GET /degrees` - Liefert alle Module
**+**`GET /degrees/:uuid` - Liefert Studiengang mit ID `:uuid`

- Falls `:uuid` nicht existiert: **404**, "StudiengangNotFound" 

`POST /degrees` - Erstellt einen neuen Studiengang

- Erforderliche Parameter: `name` (String)
- Falls Studiengang bereits besteht: **409**, "StudiengangAlreadyExists"
- Falls Parameter fehlen **400**, "ValidationError"

`PUT /degrees/:uuid` - Aktualisiert den Studiengang `:uuid`

- Falls `:uuid` nicht existiert: **404**, "StudiengangNotFound"
- Falls der neue Name von `:uuid` bereits existiert: **400**, "StudiengangAlreadyExists"

`DELETE /degrees/:uuid` - Löscht den Studiengang `:uuid`

- Falls `:uuid` nicht existiert: **404**, "StudiengangNotFound"
- Falls am Studiengang `:uuid` Beziehungen (z.B. zu Lernzielen) hängen: **409**, "RemainingRelationships"

#### Relationen
`GET /degrees/:uuid/targets` - Liefert Liste aller Lernziele des Studiengangs `uuid`

- Falls Studiengang `:uuid` nicht existiert: **404**, "StudiengangNotFound"

### <a name="lernziele">Lernziele (Targets)</a>
Ein Lernziel hängt stets an exakt einem(!) [Studiengang](#studiengang) oder an exakt einem(!) anderen Lernziel und teilt dessen Themenbereich auf.

#### Node Properties
`GET /targets` - Liefert Liste aller Lernziele
`GET /targets/:uuid` - Liefert Lernziel `:uuid`

- Falls `:uuid` nicht existiert: **404**, "LernzielNotFound"

`POST /targets` - Erstellt ein neues Lernziel

- Erforderliche Parameter: `name` (String), `parent` (String (UUID des Parents))
- Falls Parameter fehlen **400**, "ValidationError"
- Falls Parent `parent` nicht existiert: **404**, "ParentNotFound"

`PUT /targets/:uuid` - Aktualisiert Lernziel `:uuid`

- Falls `:uuid` nicht existiert: **404**, "LernzielNotFound"

`DELETE /targets/:uuid` - Löscht Lernziel `:uuid`


#### Relationen

### <a name="aufgabe">Aufgabe</a>
...
### <a name="information">Information</a>
...
### <a name="lösung">Lösung</a>
...
### <a name="benutzer">Benutzer</a>
...
## <a name="fehler">Fehler</a>