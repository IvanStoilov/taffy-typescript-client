<cfcomponent extends="BaseResource" taffy_uri="/app/{companyId}/sd/tickets/{ticketId}/comments" output="false">
  <cfset variables.services = request.pxc.servicesFactory.getTicketCommentServices() />

  <!---
    Returns the comments from the specified ticket
  --->
  <cffunction name="get" access="public" output="false">
    <cfargument name="companyId" type="string" required="true" />
    <cfargument name="ticketId" type="string" required="true" />

    <!--- Defined local variables --->
    <cfset var comments = "" />

    <!--- Check access --->
    <cfif request.accessToken.type neq "USER_TOKEN">
      <cfreturn noData().withStatus(403, "Forbidden") />
    </cfif>

    <!--- Get the ticket comments --->
    <cfinvoke component="#variables.services#" method="getTicketComments" returnvariable="comments">
      <cfinvokeargument name="companyId" value="#pxcConvertPxcRefToId(arguments.companyId, "Corporate")#" />
      <cfinvokeargument name="userId" value="#request.accessToken.userId#" />
      <cfinvokeargument name="ticketId" value="#pxcConvertPxcRefToId(arguments.ticketId, "Ticket")#" />
    </cfinvoke>

    <cfreturn representationOf(convert(comments)).withStatus(200) />
  </cffunction>

  <!---
    Add a comment to the specified ticket
  --->
  <cffunction name="post" access="public" output="false">
    <cfargument name="companyId" type="string" required="true" />
    <cfargument name="ticketId" type="string" required="true" />
    <cfargument name="comment" type="string" required="true" />
    <cfargument name="attachments" type="array" required="true" default="#arrayNew(1)#" />
    <cfargument name="userId" type="string" required="false" />
	  <cfargument name="notifiedUsers" type="array" required="false" default="#arrayNew(1)#" />

    <!--- Defined local variables --->
    <cfset var userId = "" />
    <cfset var newComment = "" />
    <cfset var headers = structNew() />
	  <cfset var notifiedUserIds = arrayNew(1) />
	  <cfset var i = "" />

    <!--- user --->
    <cfif request.accessToken.type eq "USER_TOKEN">
      <cfset userId = request.accessToken.userId />
    <cfelse>
      <cfset userId = pxcConvertPxcRefToId(arguments.userId, "User") />
    </cfif>

    <cfif arrayLen(arguments.notifiedUsers)>
      <cfloop array="#arguments.notifiedUsers#" index="i">
        <cfset arrayAppend(notifiedUserIds, pxcConvertPxcRefToId(i, "User")) />
      </cfloop>
    </cfif>

    <!--- create the ticket comment --->
    <cftransaction>
      <cfinvoke component="#variables.services#" method="createTicketComment" returnvariable="newComment">
        <cfinvokeargument name="companyId" value="#pxcConvertPxcRefToId(arguments.companyId, "Corporate")#" />
        <cfinvokeargument name="userId" value="#userId#" />
        <cfinvokeargument name="ticketId" value="#pxcConvertPxcRefToId(arguments.ticketId, "Ticket")#" />
        <cfinvokeargument name="comment" value="#arguments.comment#" />
        <cfinvokeargument name="attachments" value="#arguments.attachments#" />
		    <cfinvokeargument name="notifiedUsers" value="#notifiedUserIds#" />
      </cfinvoke>
    </cftransaction>

    <!--- Create custom response headers --->
    <cfset headers["Location"] = "/app/#arguments.companyId#/sd/tickets/#arguments.ticketId#/comments/#newComment.id#" />

    <cfreturn representationOf(newComment).withHeaders(headers).withStatus(201, "Created") />
  </cffunction>
</cfcomponent>
