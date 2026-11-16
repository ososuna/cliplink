# Cliplink

Cliplink turns long URLs into short ones. Anyone can create a Link; Users who sign in can also name, find, and delete the Links they own.

## Links

**Link**:
A Code paired with a Destination. Following the Link sends the Visitor to the Destination.
_Avoid_: URL, short URL, clip, shortened URL

**Code**:
The short identifier that makes up a Link's short URL. A Code belongs to one Link forever and is never reused, even after that Link is deleted.
_Avoid_: shortId, slug, alias, hash, id

**Destination**:
The URL a Link sends Visitors to. It is fixed when the Link is created.
_Avoid_: originalUrl, target, long URL

**Name**:
A label an Owner gives a Link, unique among that Owner's Links.
_Avoid_: title, alias

**Anonymous Link**:
A Link created by someone not signed in. It has no Owner, so nobody can rename or delete it.
_Avoid_: guest link, public link

**Deleted Link**:
A Link its Owner removed, or whose Owner deleted their User. Its Code no longer leads anywhere.
_Avoid_: inactive link, archived link

**Listing**:
The slice of an Owner's Links the dashboard shows: a page, a page size, and an optional search. Asking for a page past the end shows the last page.
_Avoid_: query, filter, pagination

**Redirect**:
Sending a Visitor from a Link to its Destination.
_Avoid_: resolve, forward

## People

**Visitor**:
Anyone who follows a Link or uses Cliplink without signing in.
_Avoid_: guest, anonymous user

**User**:
A person who signs in to Cliplink through one or more Providers.
_Avoid_: account, member, customer

**Owner**:
The User a Link belongs to.
_Avoid_: creator, author

**Provider**:
An outside service a User signs in with: Google or GitHub. A User who signs in with two Providers using the same verified email is one User. A Provider that has not verified the email can't sign in to an existing User with that email.
_Avoid_: social login, OAuth app, identity provider
