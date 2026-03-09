SELECT "internalCode", COUNT(*) as qty, array_agg("id") as ids, array_agg("tenantId") as tenants FROM "barrels" GROUP BY "internalCode" HAVING COUNT(*) > 1 ORDER BY qty DESC; 
