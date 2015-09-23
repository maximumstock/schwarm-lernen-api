// Deploys a basic set of data so that a valid admin account exists
// cleanup
match (n) optional match (n)-[r]-() delete r,n;

// Admin account
CREATE (u:User:Admin {username: "admin", password: "admin"});
