<cfcomponent extends="BaseResource" taffy_uri="/app/{companyId}/em/users/{userId}/presences/{date:\d{4}-\d{2}-\d{2}}" output="false">
  <cfset variables.services = request.pxc.servicesFactory.getPresenceServices() />

  <!---
      Delete a presence
  --->
  <cffunction name="delete" access="public" output="false">
    <cfargument name="companyId" type="string" required="true" />
    <cfargument name="userId" type="string" required="true" />
    <cfargument name="date" type="string" required="true" />

    <!--- Decode ids --->
    <cfset arguments.companyId = pxcConvertPxcRefToId(arguments.companyId, "Corporate") />
    <cfset arguments.userId = pxcConvertPxcRefToId(arguments.userId, "User") />

    <cftransaction>
      <cfset variables.services.deletePresencesForUserByDate(argumentCollection=arguments) />
    </cftransaction>

    <cfreturn noData().withStatus(200) />
  </cffunction>
</cfcomponent>