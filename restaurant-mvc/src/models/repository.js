export function createRepository(db) {
  const publicDish = { isPublished: true, archivedAt: null, category: { isActive: true, archivedAt: null } };
  const menuWhere = options => ({...publicDish,...(options.category?{category:{...publicDish.category,slug:options.category}}:{}),...(options.q?{name:{contains:options.q,mode:'insensitive'}}:{})});
  const menuOrder = {recommended:[{displayOrder:'asc'},{name:'asc'},{id:'asc'}],name:[{name:'asc'},{id:'asc'}],price_asc:[{priceMinor:'asc'},{id:'asc'}],price_desc:[{priceMinor:'desc'},{id:'asc'}]};
  return {
    db,
    staff: {
      byId: id => db.staffUser.findUnique({ where: { id } }),
      byEmail: email => db.staffUser.findUnique({ where: { email } }),
      list: () => db.staffUser.findMany({ select: { id:true, email:true, displayName:true, role:true, isActive:true }, orderBy:{createdAt:'desc'}, take:100 }),
    },
    menu: {
      list: (options={}) => db.dish.findMany({where:menuWhere(options),include:{category:true},orderBy:menuOrder[options.sort] || menuOrder.recommended,...(options.take?{skip:options.skip || 0,take:options.take}:{})}),
      count: (options={}) => db.dish.count({where:menuWhere(options)}),
      detail: slug => db.dish.findFirst({ where:{...publicDish,slug}, include:{category:true} }),
    },
    categories: () => db.category.findMany({ where:{archivedAt:null},orderBy:[{displayOrder:'asc'},{name:'asc'}],take:100 }),
    dishes: () => db.dish.findMany({where:{archivedAt:null},include:{category:true},orderBy:{name:'asc'},take:100}),
    ingredients: () => db.ingredient.findMany({where:{archivedAt:null},orderBy:{name:'asc'},take:100}),
    history: () => db.stockOperation.findMany({include:{actor:{select:{displayName:true}},movements:{include:{ingredient:true}}},orderBy:{createdAt:'desc'},take:100}),
  };
}
