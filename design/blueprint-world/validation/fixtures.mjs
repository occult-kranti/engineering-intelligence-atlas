// Independent contract fixtures. No imports from the implementation under test.
export const DEPARTMENT_NAMES = ['Leadership','Product','Engineering','Design','Research','Operations'];
export const copy = value => structuredClone(value);

export function companiesFixture(count = 2) {
  const state={version:1,companies:[],offices:[],departments:[],employees:[],assignments:[],tasks:[],notes:[]};
  for(let i=0;i<count;i++){
    const id=`co-fixture-${i}`,officeId=`of-fixture-${i}`,directorId=`em-director-${i}`,assistantId=`em-donna-${i}`;
    state.companies.push({id,name:`Company ${i}`,parentId:null,x:i*1260,z:0,width:1100,officeId,directorId,assistantId});
    state.offices.push({id:officeId,companyId:id,name:`Office ${i}`});
    for(const [order,name] of DEPARTMENT_NAMES.entries())state.departments.push({id:`dp-${i}-${name.toLowerCase()}`,companyId:id,officeId,parentId:null,name,color:'#7b9bc9',order});
    state.employees.push({id:directorId,homeCompanyId:id,name:`Director ${i}`,role:'Director',reportsToId:null},{id:assistantId,homeCompanyId:id,name:`Donna ${i}`,role:'Donna',reportsToId:directorId});
    state.assignments.push({id:`as-director-${i}`,employeeId:directorId,companyId:id,departmentId:`dp-${i}-leadership`,kind:'resident',x:null,y:null},{id:`as-donna-${i}`,employeeId:assistantId,companyId:id,departmentId:`dp-${i}-leadership`,kind:'resident',x:null,y:null});
  }
  return state;
}

export function addFixtureEmployee(state,companyIndex=0,departmentId=`dp-${companyIndex}-engineering`,name) {
  const index=state.employees.length,id=`em-worker-${index}`,companyId=`co-fixture-${companyIndex}`;
  const employee={id,homeCompanyId:companyId,name:name??`Worker ${index}`,role:'Engineer',reportsToId:`em-director-${companyIndex}`};
  state.employees.push(employee);
  state.assignments.push({id:`as-worker-${index}`,employeeId:id,companyId,departmentId,kind:'resident',x:null,y:null});
  return employee;
}

export function basicFixture() {
  const state=companiesFixture();
  for(let i=0;i<2;i++){
    const worker=addFixtureEmployee(state,i,`dp-${i}-engineering`,'Sam Same');
    state.tasks.push({id:`tk-fixture-${i}`,companyId:`co-fixture-${i}`,departmentId:`dp-${i}-engineering`,title:'Plan release',ownerId:worker.id,status:'todo',lane:'now'});
    state.notes.push({id:`nt-fixture-${i}`,companyId:`co-fixture-${i}`,text:'Same note text',color:'#e6cb7f',x:null,y:null});
  }
  return state;
}

export function hierarchicalFixture() {
  const state=basicFixture(),companyId='co-fixture-0',officeId='of-fixture-0';
  state.tasks[0].ownerId=null;
  state.departments.push({id:'dp-child',companyId,officeId,parentId:'dp-0-engineering',name:'Child team',color:'#7b9bc9',order:0},{id:'dp-grandchild',companyId,officeId,parentId:'dp-child',name:'Grandchild team',color:'#7b9bc9',order:0});
  const employee=addFixtureEmployee(state,0,'dp-grandchild','Nested worker');
  state.tasks.push({id:'tk-child',companyId,departmentId:'dp-child',title:'Child scope task',ownerId:employee.id,status:'doing',lane:'next'},{id:'tk-grandchild',companyId,departmentId:'dp-grandchild',title:'Completed nested task',ownerId:employee.id,status:'done',lane:'later'},{id:'tk-other',companyId,departmentId:'dp-0-design',title:'Other department task',ownerId:null,status:'todo',lane:'now'});
  return state;
}

export function fillEmployees(state,count) {
  while(state.employees.length<count)addFixtureEmployee(state);
  return state;
}

export function assignmentCapacityFixture() {
  const state=companiesFixture(3);
  fillEmployees(state,668);
  for(const employee of state.employees){
    for(let companyIndex=0;companyIndex<3;companyIndex++){
      if(state.assignments.length>=2000)return state;
      const companyId=`co-fixture-${companyIndex}`;
      if(state.assignments.some(a=>a.employeeId===employee.id&&a.companyId===companyId))continue;
      state.assignments.push({id:`as-host-${state.assignments.length}`,employeeId:employee.id,companyId,departmentId:`dp-${companyIndex}-engineering`,kind:'shared',x:null,y:null});
    }
  }
  throw new Error('Independent assignment fixture failed to reach its declared count');
}

export function departmentCapacityFixture() {
  const state=companiesFixture(100);
  const roots=[...state.departments];
  for(const root of roots){
    for(let childOrder=0;childOrder<4;childOrder++){
      if(state.departments.length===4096)return state;
      const child={id:`dp-cap-${state.departments.length}`,companyId:root.companyId,officeId:root.officeId,parentId:root.id,name:`Child ${childOrder}`,color:'#7b9bc9',order:childOrder};
      state.departments.push(child);
      for(let order=0;order<4;order++){
        if(state.departments.length===4096)return state;
        state.departments.push({id:`dp-cap-${state.departments.length}`,companyId:root.companyId,officeId:root.officeId,parentId:child.id,name:`Grandchild ${order}`,color:'#7b9bc9',order});
      }
    }
  }
  throw new Error('Independent department fixture failed to reach its declared count');
}

export function fillTasks(state,count) {
  while(state.tasks.length<count)state.tasks.push({id:`tk-cap-${state.tasks.length}`,companyId:'co-fixture-0',departmentId:'dp-0-engineering',title:`Task ${state.tasks.length}`,ownerId:null,status:'todo',lane:'now'});
  return state;
}

export function fillNotes(state,count) {
  while(state.notes.length<count)state.notes.push({id:`nt-cap-${state.notes.length}`,companyId:'co-fixture-0',text:`Note ${state.notes.length}`,color:'#e6cb7f',x:null,y:null});
  return state;
}
