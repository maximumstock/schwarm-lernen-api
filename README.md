# General
This was a voluntary project at University of Applied Sciences Coburg (Germany) to support a PhD candidate with her work about how
a group of university students can interact with each other within a semester course's studies. This project was a basic
version of a learning platform to support these studies.

The platform tried to provide a way to document each student's learning progression and to give external motivation for 
students to do assignments in order to gain virtual points within the system (see gamification).

This repository contains the backend part of this first basic version of the planned platform and was written in Javascript/uses Node.js.
To raise interest in the project the graph database Neo4j was used to store the platform's data. 

Automated tests were dropped mainly due to deadline restrictions. #sorry

## API
The backend mainly consists of a RESTlike API; (german) documentation can be found [here](API_DOC.md).

## Used software
- [node.js](https://nodejs.org/en/) with [Express](http://expressjs.com/) framework
- [node-neo4j](https://github.com/thingdom/node-neo4j) neo4j driver for node.js
- neo4j plugin for automatic uuid generation: [https://github.com/graphaware/neo4j-uuid](https://github.com/graphaware/neo4j-uuid)

