"""Author textured marine animals and deformation shapes in Blender.

Run in a fresh Blender background process. Coordinates in the builders are
game coordinates (Y up, +Z facing forward); B() converts them for Blender.
"""
import math
from pathlib import Path

import bpy
import numpy as np
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public' / 'models' / 'creatures'
OUT.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.context.preferences.filepaths.save_version = 0


def B(p):
    return Vector((p[0], -p[2], p[1]))


def material(name, color, rough=.5, glow=0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*color, 1)
    bsdf.inputs['Roughness'].default_value = rough
    if glow:
        bsdf.inputs['Emission Color'].default_value = (*color, 1)
        bsdf.inputs['Emission Strength'].default_value = glow
    return mat


def textured_skin(name, light, dark, seed, rough=.55):
    """Pack color and tangent normal maps: both survive glTF export."""
    mat = material(name, light, rough)
    rng = np.random.default_rng(seed)
    size = 512
    def noise(cells):
        grid=rng.random((cells,cells))
        y,x=np.mgrid[0:size,0:size]/size*cells
        ix=x.astype(int);iy=y.astype(int);fx=x-ix;fy=y-iy
        fx=fx*fx*(3-2*fx);fy=fy*fy*(3-2*fy)
        return ((grid[iy,ix]*(1-fx)+grid[iy,(ix+1)%cells]*fx)*(1-fy)
                +(grid[(iy+1)%cells,ix]*(1-fx)+grid[(iy+1)%cells,(ix+1)%cells]*fx)*fy)
    broad = .55*noise(9)+.3*noise(21)+.15*noise(43)
    broad = np.clip((broad-.25)*1.9,0,1)
    fine = noise(117)
    flecks = np.maximum(0, (fine-.66)/.34)
    value = np.clip(.22 + .65*broad - .3*flecks + rng.normal(0,.025,(size,size)), 0, 1)
    rgb = np.array(dark)[None,None,:] + value[:,:,None]*(np.array(light)-np.array(dark))[None,None,:]
    image = bpy.data.images.new(name+' pigmentation', width=size, height=size)
    image.pixels.foreach_set(np.concatenate([rgb, np.ones((size,size,1))],axis=2).astype(np.float32).ravel())
    image.pack()
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    bsdf = nodes.get('Principled BSDF')
    tex = nodes.new('ShaderNodeTexImage'); tex.image = image
    links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
    height = .6*fine + .4*rng.random((size,size))
    dx = (np.roll(height,-1,axis=1)-np.roll(height,1,axis=1))*.35
    dy = (np.roll(height,-1,axis=0)-np.roll(height,1,axis=0))*.35
    normal = np.stack([-dx,-dy,np.ones_like(dx)],axis=2)
    normal /= np.linalg.norm(normal,axis=2,keepdims=True)
    normal_image = bpy.data.images.new(name+' pores',width=size,height=size)
    normal_image.colorspace_settings.name = 'Non-Color'
    normal_image.pixels.foreach_set(np.concatenate([normal*.5+.5,np.ones((size,size,1))],axis=2).astype(np.float32).ravel())
    normal_image.pack()
    texture = nodes.new('ShaderNodeTexImage'); texture.image = normal_image
    normal_node = nodes.new('ShaderNodeNormalMap'); normal_node.inputs['Strength'].default_value = .45
    links.new(texture.outputs['Color'],normal_node.inputs['Color'])
    links.new(normal_node.outputs['Normal'],bsdf.inputs['Normal'])
    return mat


SQUID = textured_skin('Squid chromatophores',(.67,.36,.32),(.22,.07,.085),12,.39)
OCTO = textured_skin('Octopus mottled dermis',(.57,.30,.15),(.14,.062,.035),25,.56)
SHELL = textured_skin('Crab calcified shell',(.56,.255,.105),(.12,.052,.025),34,.65)
FISH = textured_skin('Angler pebbled skin',(.22,.255,.24),(.035,.045,.046),48,.62)
SUCKER = material('Sucker ivory tissue',(.55,.39,.28),.6)
EYE = material('Wet black cornea',(.008,.012,.009),.12)
IRIS = material('Bronze iris',(.29,.21,.075),.3)
TOOTH = material('Translucent ivory teeth',(.66,.67,.49),.35)
MOUTH = material('Mouth interior',(.009,.002,.004),.72)
FIN = textured_skin('Thin fin membrane',(.29,.24,.17),(.08,.085,.06),58,.48)
GLOW = material('Bioluminescent esca',(.48,.95,.71),.3,3)


def obj_mesh(name, verts, faces, mat, uvs=None):
    data = bpy.data.meshes.new(name)
    data.from_pydata([B(v) for v in verts], [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    data.materials.append(mat)
    for p in data.polygons: p.use_smooth = True
    uv = data.uv_layers.new(name='UVMap')
    for polygon in data.polygons:
        for li in polygon.loop_indices:
            vi = data.loops[li].vertex_index
            uv.data[li].uv = uvs[vi] if uvs else (verts[vi][0]*.28, verts[vi][1]*.28+verts[vi][2]*.13)
    return obj


def ellipsoid(name, pos, scale, mat, segments=40, rings=24):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, location=B(pos))
    obj = bpy.context.object; obj.name = name
    obj.scale = (scale[0],scale[2],scale[1])
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    obj.data.materials.append(mat)
    for p in obj.data.polygons: p.use_smooth=True
    return obj


def smooth_path(points, steps=48):
    points = [Vector(p) for p in points]
    result=[]
    for i in range(steps+1):
        u=i/steps*(len(points)-1); k=min(int(u),len(points)-2); t=u-k
        p0=points[max(0,k-1)]; p1=points[k]; p2=points[k+1]; p3=points[min(len(points)-1,k+2)]
        result.append((2*p1+(-p0+p2)*t+(2*p0-5*p1+4*p2-p3)*t*t+(-p0+3*p1-3*p2+p3)*t*t*t)*.5)
    return result


def tube(name, points, radius, mat, end=.01, steps=40, sides=12, suckers=False):
    path=smooth_path(points,steps)
    verts=[]; faces=[]; uv=[]; weights=[]; sucker_faces=[]; ring_starts=[]
    for i,p in enumerate(path):
        t=i/steps
        tangent=(path[min(i+1,steps)]-path[max(0,i-1)]).normalized()
        reference=Vector((0,0,1)) if abs(tangent.z)<.9 else Vector((1,0,0))
        a=tangent.cross(reference).normalized(); b=tangent.cross(a).normalized()
        r=end+(radius-end)*(1-t)**.9
        ring_starts.append(len(verts))
        for j in range(sides+1):
            angle=j/sides*math.tau
            verts.append(tuple(p+r*(a*math.cos(angle)+b*math.sin(angle))))
            uv.append((j/sides,t*2)); weights.append(t)
        if i:
            base=ring_starts[-1];previous=ring_starts[-2]
            for j in range(sides):faces.append((previous+j,previous+j+1,base+j+1,base+j))
        if suckers and 2<i<steps-4 and i%2==0:
            # Two recessed cup rows on the underside, joined to the deforming arm.
            for side in [-1,1]:
                normal=(b*.82+a*side*.58).normalized()
                center=p+normal*r*.94
                cup_radius=r*.42
                axis=tangent; across=normal.cross(axis).normalized()
                start=len(verts)
                for ring in range(3):
                    rr=cup_radius*(1,.78,.36)[ring]
                    lift=(0,.025,-.01)[ring]*(r/.2)
                    for j in range(10):
                        angle=j/10*math.tau
                        verts.append(tuple(center+normal*lift+rr*(axis*math.cos(angle)+across*math.sin(angle))))
                        uv.append((j/10,ring/2));weights.append(t)
                for ring in range(2):
                    for j in range(10):
                        faces.append((start+ring*10+j,start+ring*10+(j+1)%10,start+(ring+1)*10+(j+1)%10,start+(ring+1)*10+j))
                        sucker_faces.append(len(faces)-1)
    faces.extend([tuple(range(sides,-1,-1)),tuple(ring_starts[-1]+j for j in range(sides+1))])
    obj=obj_mesh(name,verts,faces,mat,uv)
    if suckers:
        obj.data.materials.append(SUCKER)
        for index in sucker_faces:obj.data.polygons[index].material_index=1
    return obj,weights


def flex(obj, weights, amount=.25, phase=0):
    obj['flowPhase']=phase
    obj.shape_key_add(name='Basis')
    for index in range(2):
        shape=obj.shape_key_add(name='Flow'+str(index))
        for i,vertex in enumerate(shape.data):
            t=weights[i]
            delta=(math.sin(t*5+phase+index*math.pi)*amount*t*t,
                   math.cos(t*4+phase+index*math.pi)*amount*.45*t*t,
                   math.cos(t*5+phase+index*math.pi)*amount*t*t)
            vertex.co+=B(delta)


def membrane(name, points, mat=FIN):
    # A gently curved fan with a shared root and radial surface topology.
    root=Vector(points[0]); rim=smooth_path(points[1:],32)
    verts=[]; faces=[]; uv=[]
    for i in range(9):
        t=i/8
        for j,p in enumerate(rim):
            v=root.lerp(p,t);v.z+=math.sin(t*math.pi)*.075
            verts.append(tuple(v));uv.append((j/32,t))
            if i and j:
                k=i*33+j;faces.append((k,k-1,k-34,k-33))
    obj=obj_mesh(name,verts,faces,mat,uv)
    mat.use_backface_culling=False
    return obj


def join_static(objects,name):
    if not objects:return
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:obj.select_set(True)
    bpy.context.view_layer.objects.active=objects[0]
    bpy.ops.object.join()
    objects[0].name=name
    return objects[0]


def pivot(obj,point):
    location=B(point)
    for v in obj.data.vertices:v.co-=location-obj.location
    obj.location=location


def eye_pair(x,y,z,size,slit=False):
    for side in [-1,1]:
        ellipsoid('Eye socket',(side*x,y,z),(size*1.28,size*1.13,size*.75),SQUID if not slit else OCTO)
        ellipsoid('Cornea',(side*x,y,z+size*.46),(size,size*.92,size*.6),IRIS)
        ellipsoid('Pupil',(side*x,y,z+size*.95),(size*.72,size*(.19 if slit else .68),size*.15),EYE)


def squid():
    # An elongated pointed mantle with triangular lateral fins.
    levels=[(-.05,.49),(.1,.6),(.55,.69),(1.2,.63),(1.9,.46),(2.6,.23),(3.05,.008)]
    path=smooth_path([(r,y,0) for y,r in levels],64)
    verts=[];faces=[];uv=[]
    for i,p in enumerate(path):
        for j in range(49):
            a=j/48*math.tau
            verts.append((p.x*math.cos(a),p.y,p.x*.84*math.sin(a)))
            uv.append((j/48,i/64))
            if i and j:
                k=i*49+j;faces.append((k-49,k-50,k-1,k))
    obj_mesh('Tapered mantle',verts,faces,SQUID,uv)
    ellipsoid('Cephalic collar',(0,-.25,0),(.56,.45,.52),SQUID)
    eye_pair(.48,-.28,.26,.25)
    tube('Siphon',[(0,-.25,.3),(0,-.56,.56),(0,-.82,.63)],.18,SQUID,.12,20)
    for side in [-1,1]:
        fin=membrane('Mantle fin',[(side*.25,1.7,0),(side*.12,2.92,0),(side*1.35,1.73,-.05),(side*.54,.7,0)],SQUID)
        flex(fin,[max(0,min(1,abs(v.co.x)/1.35)) for v in fin.data.vertices],.12,side)
    for i in range(10):
        angle=i*math.tau/10
        x,z=math.cos(angle),math.sin(angle)
        long=i in (1,6); length=4.5 if long else 2.75
        points=[(x*.34,-.48,z*.34),(x*.57,-1.1,z*.5),(x*.72,-length*.6,z*.65),
                (x*.9,-length*.86,z*.75),(x*.9+.24,-length,z*.75+.15)]
        arm,w=tube('Feeding tentacle' if long else 'Squid arm',points,.095 if long else .15,SQUID,.014,56,12,True)
        flex(arm,w,.4,i*.7)
        if long:
            club,w=tube('Tentacular club',points[-2:],.12,SQUID,.015,20,12,True)
            # Keep clubs aligned with their matching arm deformation.
            flex(club,[.86+.14*t for t in w],.4,i*.7)


def octopus():
    head=ellipsoid('Mantle',(0,.85,-.25),(.88,1.16,.93),OCTO,64,40)
    for v in head.data.vertices:
        p=v.co; p.x*=1+.04*math.sin(p.z*10)*math.cos(p.y*6)
    ellipsoid('Head',(0,.05,.15),(.8,.55,.72),OCTO)
    eye_pair(.64,.29,.64,.19,True)
    tube('Funnel',[(.5,.07,.35),(.75,-.03,.65),(.85,-.05,.82)],.14,OCTO,.1,16)
    for i in range(8):
        a=i*math.tau/8
        def radial(r,y,offset=0):return (r*math.cos(a+offset),y,r*math.sin(a+offset))
        points=[radial(.5,-.12),radial(1.05,-.34),radial(1.8,-.52,.09),radial(2.6,-.6,.2),radial(3.0,-.35,.38),radial(2.95,-.15,.56)]
        arm,w=tube('Octopus arm',points,.3,OCTO,.012,64,14,True);flex(arm,w,.17,i*.8)
        membrane('Interbrachial web',[(0,-.12,0),radial(.75,-.15),radial(1.3,-.36,.22),radial(.8,-.2,math.tau/8)],OCTO)
    # Small irregular papillae on the dorsal mantle break the smooth toy silhouette.
    rng=np.random.default_rng(24)
    for i in range(70):
        a=rng.uniform(0,math.tau);v=rng.uniform(.2,2.6)
        x=.88*math.sin(v)*math.cos(a); y=.85+1.16*math.cos(v); z=-.25+.93*math.sin(v)*math.sin(a)
        if z>.5 and y<.6:continue
        r=rng.uniform(.025,.065)
        ellipsoid('Dermal papilla',(x,y,z),(r,r*.7,r),OCTO,8,6)


def crab():
    ellipsoid('Dorsal carapace',(0,.65,-.1),(1.3,.46,1.02),SHELL,64,32)
    ellipsoid('Ventral plates',(0,.4,-.1),(1.12,.24,.86),SHELL)
    for i in range(24):
        a=i*math.tau/24
        start=(1.18*math.cos(a),.68,.94*math.sin(a)-.1)
        end=(1.42*math.cos(a),.71,1.16*math.sin(a)-.1)
        tube('Marginal spine',[start,end],.075,SHELL,.002,4,8)
    for side in [-1,1]:
        tube('Eyestalk',[(side*.43,.72,.66),(side*.55,1.0,.87)],.065,SHELL,.05,8)
        ellipsoid('Compound eye',(side*.55,1.02,.9),(.115,.09,.11),EYE,24,16)
        tube('Antenna',[(side*.2,.65,.85),(side*.3,.8,1.22),(side*.45,.83,1.6)],.025,SHELL,.003,16,8)
        for i in range(4):
            start=(side*.98,.55,.55-i*.38)
            points=[start,(side*1.45,.72,.75-i*.58),(side*2.1,.65,1.03-i*.85),(side*2.75,.02,1.38-i*1.1)]
            parts=[]
            for j in range(3):
                segment,_=tube('Leg segment',points[j:j+2],(.16,.105,.063)[j],SHELL,(.11,.065,.007)[j],8,12);parts.append(segment)
                if j<2:parts.append(ellipsoid('Leg articulation',points[j+1],(.13,.12,.13),SHELL,20,12))
            leg=join_static(parts,'WalkLeg_'+str(side)+'_'+str(i));pivot(leg,start)
        start=(side*.85,.6,.68)
        points=[start,(side*1.37,.5,1.17),(side*1.45,.75,1.68)]
        tube('Cheliped',points,.2,SHELL,.15,18)
        ellipsoid('Claw palm',(side*1.43,.79,1.92),(.36,.25,.5),SHELL)
        for finger in [-1,1]:
            points=[(side*1.43+finger*.2,.79,2.15),(side*1.43+finger*.3,.8,2.53),(side*1.43+finger*.14,.8,2.85),(side*1.43,.8,2.97)]
            tube('Curved chela finger',points,.14,SHELL,.006,24)
            for i in range(4):
                z=2.29+i*.115
                tube('Claw serration',[(side*1.43+finger*.22,.79,z),(side*1.43+finger*.1,.79,z+.055)],.04,TOOTH,.003,4,6)
    rng=np.random.default_rng(6)
    for i in range(80):
        x=rng.uniform(-1.1,1.1);z=rng.uniform(-.9,.8)
        rr=(x/1.3)**2+((z+.1)/1.02)**2
        if rr<.9:
            y=.65+.46*math.sqrt(1-rr);r=rng.uniform(.02,.045)
            ellipsoid('Shell tubercle',(x,y,z),(r,r*.7,r),SHELL,8,6)


def angler():
    # Open-front body and recessed throat: teeth surround a real cavity.
    profiles=[(-1.6,.1,.15,0),(-1.1,.5,.6,0),(-.4,.91,1.02,0),(.4,1.03,1.03,0),(1.03,.98,.88,-.13),(1.43,.88,.75,-.22)]
    verts=[];faces=[];uv=[]
    for i,(z,rx,ry,cy) in enumerate(profiles):
        for j in range(65):
            a=j/64*math.tau; ripple=1+.025*math.cos(a*7)
            verts.append((rx*math.cos(a)*ripple,cy+ry*math.sin(a)*ripple,z));uv.append((j/64,i/5))
            if i and j:
                k=i*65+j;faces.append((k,k-1,k-66,k-65))
    body=obj_mesh('Open jaw body',verts,faces,FISH,uv)
    modifier=body.modifiers.new('Organic surface','SUBSURF');modifier.levels=2
    bpy.context.view_layer.objects.active=body;bpy.ops.object.modifier_apply(modifier=modifier.name)
    verts=[];faces=[]
    for i in range(13):
        t=i/12
        for j in range(65):
            a=j/64*math.tau;r=(1-t)**.6*.99+.01
            verts.append((.88*r*math.cos(a),-.22+.75*r*math.sin(a),1.43-1.15*t))
            if i and j:
                k=i*65+j;faces.append((k-65,k-66,k-1,k))
    obj_mesh('Recessed throat',verts,faces,MOUTH)
    rim=[(.88*math.cos(a),-.22+.75*math.sin(a),1.445) for a in np.linspace(0,math.tau,65)]
    tube('Fleshy lip',rim,.065,FISH,.065,96,10)
    rng=np.random.default_rng(51)
    for jaw in [-1,1]:
        for i in range(19):
            x=-.82+i*1.64/18+rng.uniform(-.012,.012)
            y=-.22+jaw*.71*math.sqrt(max(0,1-(x/.86)**2))
            length=rng.uniform(.23,.58)*(1-.25*abs(x))
            tip=(x*.91,y-jaw*length,1.32+rng.uniform(-.04,.04))
            tube('Needle tooth',[(x,y,1.46),(x*.97,y-jaw*length*.45,1.51),tip],.019,TOOTH,.001,10,6)
    for side in [-1,1]:
        ellipsoid('Sunken eye',(side*.84,.55,.77),(.13,.14,.11),EYE,32,20)
        tube('Supraorbital ridge',[(side*.62,.65,.82),(side*.86,.77,.76),(side*.99,.59,.63)],.085,FISH,.055,20)
        for i in range(4):
            tube('Gill slit',[(side*.93,.31-i*.13,.19),(side*1.01,.17-i*.13,.02),(side*.91,.05-i*.13,-.13)],.02,MOUTH,.01,14,6)
        fin=membrane('PectoralFin_'+str(side),[(side*.86,-.3,-.2),(side*1.25,-.3,.07),(side*1.94,-.5,-.5),(side*1.65,-.51,-1.1),(side*.92,-.32,-.8)])
        fin_parts=[fin]
        for i in range(6):
            ray,_=tube('Pectoral fin ray',[(side*.9,-.3,-.25),(side*(1.2+i*.1),-.4,-.18-i*.16)],.012,FISH,.004,12,6)
            fin_parts.append(ray)
        fin=join_static(fin_parts,'PectoralFin_'+str(side))
        flex(fin,[min(1,max(0,(abs(v.co.x)-.86)/1.14)) for v in fin.data.vertices],.13,side)
    tail=membrane('CaudalFin',[(0,0,-1.3),(0,.12,-1.55),(0,.78,-2.45),(0,-.6,-2.6),(0,-.15,-1.55)])
    tail_parts=[tail]
    for i in range(7):
        ray,_=tube('Caudal ray',[(0,0,-1.45),(0,-.55+i*.2,-2.4)],.016,FISH,.005,16,6)
        tail_parts.append(ray)
    tail=join_static(tail_parts,'CaudalFin')
    flex(tail,[min(1,max(0,(v.co.y-1.3)/1.3)) for v in tail.data.vertices],.28)
    tube('Illicium',[(0,.91,.35),(0,1.75,.52),(.07,2.0,1.35),(.12,1.71,1.89)],.045,FISH,.025,48)
    ellipsoid('Esca',(.12,1.69,1.9),(.12,.16,.12),GLOW,32,20)
    rng=np.random.default_rng(90)
    for i in range(65):
        a=rng.uniform(0,math.tau);z=rng.uniform(-.65,.55)
        r=.9 if z<0 else 1
        ellipsoid('Skin nodule',(r*math.cos(a),r*math.sin(a),z),(.025,.035,.035),FISH,8,6)


for name,builder in [('squid',squid),('octopus',octopus),('crab',crab),('angler',angler)]:
    collection=bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(collection)
    bpy.context.view_layer.active_layer_collection=bpy.context.view_layer.layer_collection.children[name]
    builder()
    # Merge stationary tissue; preserve independent deforming meshes and leg pivots.
    static=[o for o in collection.objects if o.type=='MESH' and not o.data.shape_keys and not o.name.startswith('WalkLeg_')]
    join_static(static,name+'_anatomy')
    bpy.ops.object.select_all(action='DESELECT')
    for obj in collection.objects:obj.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(OUT/(name+'.glb')),export_format='GLB',use_selection=True,
                              export_apply=False,export_animations=False,export_morph=True,export_extras=True)
    print('CREATURE_EXPORTED',name,flush=True)

# Lay out the editable source after exporting origin-centered game assets.
for i,name in enumerate(['squid','octopus','crab','angler']):
    for obj in bpy.data.collections[name].objects:
        obj.location.x+=(i-1.5)*7
bpy.ops.object.select_all(action='DESELECT')
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type=='VIEW_3D':
            area.spaces.active.region_3d.view_distance=26
            area.spaces.active.region_3d.view_location=(0,0,0)
            area.spaces.active.shading.type='MATERIAL'
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'blender'/'marine_creatures.blend'))
print('MARINE_CREATURES_COMPLETE',flush=True)
