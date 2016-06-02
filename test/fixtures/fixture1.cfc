<cfcomponent extends="BaseResource" taffy_uri="/admin/sd/stats" output="false">
  <cfset variables.services = request.pxc.servicesFactory.getTicketServices() />

  <!---
    ADMIN : Retrieves all the SD stats for a company in a date frame
  --->
  <cffunction name="get" access="public" output="false">
    <cfargument name="companyId" type="string" required="true" />
    <cfargument name="from" type="date" required="false" />
    <cfargument name="to" type="date" required="false" />

    <!--- Defined local variables --->
    <cfset var stats = "" />

    <!--- Check access --->
    <cfif (request.accessToken.type eq "COMPANY_TOKEN") AND (request.accessToken.companyId neq arguments.companyId)>
      <cfreturn noData().withStatus(403, "Forbidden") />
    </cfif>

    <!--- Get the stats list --->
    <cfinvoke component="#variables.services#" method="adminStatsForCompany" returnvariable="stats">
      <cfinvokeargument name="companyId" value="#pxcConvertPxcRefToId(arguments.companyId, "Corporate")#" />
      <cfinvokeargument name="from" value="#arguments.from#" />
      <cfinvokeargument name="to" value="#arguments.to#" />
    </cfinvoke>

    <cfreturn representationOf(stats).withStatus(200) />
  </cffunction>
</cfcomponent>
