declare module "cannon-es" {
  export class Vec3 {
    constructor(x?: number, y?: number, z?: number);
    x: number; y: number; z: number;
    set(x: number, y: number, z: number): void;
  }
  export class Quaternion {
    setFromEuler(x: number, y: number, z: number, order?: string): void;
  }
  export class Shape {}
  export class Sphere extends Shape {
    constructor(radius: number);
  }
  export class Plane extends Shape {}
  export class Body {
    constructor(options?: { mass?: number; shape?: Shape });
    position: Vec3;
    velocity: Vec3;
    quaternion: Quaternion;
    linearDamping: number;
    addEventListener(event: string, listener: (...args: any[]) => void): void;
  }
  export class World {
    constructor(options?: { gravity?: Vec3 });
    addBody(body: Body): void;
    removeBody(body: Body): void;
    step(dt: number, timeSinceLastCalled?: number): void;
  }
}


