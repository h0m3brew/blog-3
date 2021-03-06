import {
  Component,
  OnInit,
  Input,
  Type,
  Injector,
  ɵrenderComponent as renderComponent,
  ɵmarkDirty as markDirty,
  ɵcreateInjector as createInjector,
  ViewContainerRef,
  ComponentFactoryResolver
} from "@angular/core";

import { Subject, BehaviorSubject, merge, of } from "rxjs";
import { tap, distinctUntilChanged, filter, takeUntil, mergeMap } from "rxjs/operators";

import { LoadComponent, Route } from "./route";
import { RouteParams, Params } from "./route-params.service";
import { RouterComponent } from "./router.component";


@Component({
  selector: "route",
  template: ''
})
export class RouteComponent implements OnInit {
  private destroy$ = new Subject();
  @Input() path: string;
  @Input() component: Type<any>;
  @Input() loadComponent: LoadComponent;
  route!: Route;
  rendered = null;
  private _routeParams$ = new BehaviorSubject<Params>({});
  routeParams$ = this._routeParams$.asObservable();

  constructor(
    private injector: Injector,
    private router: RouterComponent,
    private resolver: ComponentFactoryResolver,
    private viewContainerRef: ViewContainerRef
  ) {}

  ngOnInit(): void {
    // account for root level routes, don't add the basePath
    const path = this.router.parentRouterComponent
      ? this.router.parentRouterComponent.basePath + this.path
      : this.path;

    this.route = this.router.registerRoute({
      path,
      component: this.component,
      loadComponent: this.loadComponent
    });

    const activeRoute$ = this.router.activeRoute$
      .pipe(
        filter(ar => ar !== null),
        distinctUntilChanged(),
        mergeMap(current => {
          if (current.route === this.route) {
            this._routeParams$.next(current.params);

            if (!this.rendered) {
              return this.loadAndRenderRoute(current.route);
            }
          } else if (this.rendered) {
            return of(this.clearView());
          }

          return of(null);
        })
      );

    // const routeParams$ = this._routeParams$
    //   .pipe(
    //     distinctUntilChanged(),
    //     filter(() => !!this.rendered),
        // tap(() => markDirty(this.rendered))
      // );
    
    merge(activeRoute$).pipe(
      takeUntil(this.destroy$),
    ).subscribe();
  }

  ngOnDestroy() {
    this.destroy$.next();
  }

  loadAndRenderRoute(route: Route) {
    if (route.loadComponent) {
      return route.loadComponent().then(component => {
        return this.renderView(component);
      });
    } else {
      return of(this.renderView(route.component));
    }
  }

  renderView(component: Type<any>) {
    const cmpInjector = createInjector({}, this.injector, [
      { provide: RouteParams, useValue: this.routeParams$ }
    ]);

    // this.rendered = renderComponent(component, {
    //   host,
    //   injector: cmpInjector
    // });
    const componentFactory = this.resolver.resolveComponentFactory(component);
    this.rendered = this.viewContainerRef.createComponent(componentFactory, this.viewContainerRef.length, cmpInjector);

    return this.rendered;
  }

  clearView() {
    // this.outlet.nativeElement.innerHTML = "";
    this.viewContainerRef.clear();
    this.rendered = null;

    return this.rendered;
  }
}
